import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

const platform = 'https://api.minepi.com/v2'
const paymentId = /^[A-Za-z0-9_-]{1,128}$/
const txId = /^[a-f0-9]{64}$/i

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function bodyOf(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 4096) throw new RequestError(413, 'Request too large.')
  }
  try { return JSON.parse(body) } catch { throw new RequestError(400, 'Invalid JSON.') }
}

export function createPaymentServer({ apiKey, platformFetch = fetch } = {}) {
  async function pi(path, authorization, body) {
    const response = await platformFetch(`${platform}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      if (path === 'me' && response.status === 401) throw new RequestError(401, 'Sign in again to verify your Pi account.')
      throw new RequestError(502, 'Pi did not confirm the request.')
    }
    return response.json()
  }

  return createServer(async (request, response) => {
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(data))
    }
    try {
      if (request.method === 'GET' && request.url === '/api/pi/status') {
        return send(200, { mode: apiKey ? 'testnet' : 'mock' })
      }
      const action = { '/api/pi/approve': 'approve', '/api/pi/complete': 'complete' }[request.url]
      if (request.method !== 'POST' || !action) return send(404, { error: 'Not found.' })
      const data = await bodyOf(request)
      if (!data || typeof data.id !== 'string' || !paymentId.test(data.id) ||
          typeof data.taskId !== 'string' || !paymentId.test(data.taskId) ||
          typeof data.amount !== 'number' || !(data.amount > 0 && data.amount <= 10_000) ||
          Number(data.amount.toFixed(7)) !== data.amount ||
          (action === 'complete' && (typeof data.txid !== 'string' || !txId.test(data.txid)))) {
        throw new RequestError(400, 'Invalid payment details.')
      }
      if (!apiKey) return send(200, { mode: 'mock', id: data.id })

      const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
      if (!token) throw new RequestError(401, 'Pi sign-in is required.')
      const user = await pi('me', `Bearer ${token}`)
      const key = `Key ${apiKey}`
      const path = `payments/${data.id}`
      const payment = await pi(path, key)
      const matches = item => item.identifier === data.id && item.user_uid === user.uid &&
        item.direction === 'user_to_app' && item.network === 'Pi Testnet' &&
        item.amount === data.amount && item.metadata?.taskId === data.taskId &&
        item.status && !item.status.cancelled && !item.status.user_cancelled
      if (!user.uid || !matches(payment)) {
        throw new RequestError(403, 'The payment does not match this Testnet account and task.')
      }
      if (action === 'approve') {
        const approved = payment.status.developer_approved ? payment : await pi(`${path}/approve`, key, {})
        if (!matches(approved) || !approved.status.developer_approved) throw new RequestError(502, 'Approval was not confirmed.')
      } else {
        if (payment.transaction?.txid !== data.txid) throw new RequestError(409, 'No matching transaction is available yet.')
        const completed = payment.status.developer_completed ? payment : await pi(`${path}/complete`, key, { txid: data.txid })
        if (!matches(completed) || completed.transaction?.txid !== data.txid ||
            !completed.status.transaction_verified || !completed.status.developer_completed) {
          throw new RequestError(502, 'Completion was not verified.')
        }
      }
      return send(200, { mode: 'testnet', id: data.id })
    } catch (error) {
      const failure = error instanceof RequestError ? error : new RequestError(502, 'The sandbox request could not be verified.')
      return send(failure.status, { error: failure.message })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createPaymentServer({ apiKey: process.env.PI_API_KEY }).listen(8787, '127.0.0.1', () => {
    console.log(`Pi Tasks payment server listening on http://127.0.0.1:8787 (${process.env.PI_API_KEY ? 'Testnet' : 'mock'})`)
  })
}
