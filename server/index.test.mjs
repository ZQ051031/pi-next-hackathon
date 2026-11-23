// @vitest-environment node
import { once } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { createPaymentServer } from './index.mjs'

const txid = 'a'.repeat(64)
const details = { id: 'test-payment', taskId: 'test-task', amount: 4, txid }
const transaction = { txid, verified: true }
const fixture = {
  identifier: details.id, user_uid: 'alice', network: 'Pi Testnet', direction: 'user_to_app',
  amount: details.amount, metadata: { taskId: details.taskId }, transaction,
  status: { developer_approved: false, developer_completed: false, transaction_verified: false },
}
let server

async function start(options) {
  server = createPaymentServer(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}/api/pi`
}

function post(base, action, data = details) {
  return fetch(`${base}/${action}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

afterEach(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

it('labels no-key responses as mock and never calls Pi', async () => {
  const platformFetch = vi.fn()
  const base = await start({ platformFetch })
  expect(await (await fetch(`${base}/status`)).json()).toEqual({ mode: 'mock' })
  expect(await (await post(base, 'complete')).json()).toEqual({ mode: 'mock', id: details.id })
  expect(platformFetch).not.toHaveBeenCalled()
})

it('verifies the user and payment, approves, then confirms a verified Testnet transaction', async () => {
  let status = fixture.status
  const platformFetch = vi.fn(async (url, options) => {
    if (url.endsWith('/me')) {
      expect(options.headers.Authorization).toBe('Bearer test-token')
      return Response.json({ uid: 'alice' })
    }
    expect(options.headers.Authorization).toBe('Key fake-test-key')
    if (url.endsWith('/approve')) {
      expect(options.method).toBe('POST')
      status = { ...status, developer_approved: true }
    }
    if (url.endsWith('/complete')) {
      expect(JSON.parse(options.body)).toEqual({ txid })
      status = { ...status, developer_completed: true, transaction_verified: true }
    }
    return Response.json({ ...fixture, status })
  })
  const base = await start({ apiKey: 'fake-test-key', platformFetch })
  const confirmed = { mode: 'testnet', id: details.id }
  expect(await (await post(base, 'approve')).json()).toEqual(confirmed)
  expect(await (await post(base, 'complete')).json()).toEqual(confirmed)
  expect(await (await post(base, 'complete')).json()).toEqual(confirmed)
  expect(platformFetch.mock.calls.filter(([url]) => url.endsWith('/complete'))).toHaveLength(1)
})

it.each([
  ['another owner', { user_uid: 'someone-else' }],
  ['Mainnet', { network: 'Pi Network' }],
  ['a different reward', { amount: 100 }],
  ['another task', { metadata: { taskId: 'unrelated' } }],
])('refuses to approve or complete a payment for %s', async (_label, mismatch) => {
  const platformFetch = vi.fn(async url => Response.json(url.endsWith('/me') ? { uid: 'alice' } : { ...fixture, ...mismatch }))
  const base = await start({ apiKey: 'fake-test-key', platformFetch })
  expect((await post(base, 'approve')).status).toBe(403)
  expect((await post(base, 'complete')).status).toBe(403)
  expect(platformFetch.mock.calls.some(([url]) => /\/(approve|complete)$/.test(url))).toBe(false)
})

it('does not issue a receipt when Pi reports unverified completion', async () => {
  const platformFetch = vi.fn(async url => Response.json(url.endsWith('/me') ? { uid: 'alice' } : {
    ...fixture, status: { ...fixture.status, developer_approved: true, developer_completed: true },
  }))
  const base = await start({ apiKey: 'fake-test-key', platformFetch })
  expect((await post(base, 'complete')).status).toBe(502)
})
