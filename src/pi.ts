import type { Receipt, Task, User } from './tasks'

type Session = { user: User; accessToken: string; incomplete: IncompletePayment[] }
export type IncompletePayment = {
  identifier: string
  metadata: { taskId?: string }
  transaction: { txid: string } | null
}
type PiSdk = {
  init: (options: { version: '2.0'; sandbox: true }) => void
  authenticate: (
    scopes: ['username', 'payments'],
    onIncomplete: (payment: IncompletePayment) => void,
  ) => Promise<{ user: { uid: string; username: string }; accessToken: string }>
  createPayment: (
    payment: { amount: number; memo: string; metadata: { taskId: string } },
    callbacks: {
      onReadyForServerApproval: (id: string) => void
      onReadyForServerCompletion: (id: string, txid: string) => void
      onCancel: () => void
      onError: (error: Error) => void
    },
  ) => void
}
declare global {
  interface Window { Pi?: PiSdk }
}

export const demoUsers = [
  { id: 'demo-maya', name: 'maya.design' },
  { id: 'demo-jordan', name: 'jordan.codes' },
] satisfies User[]

export const mockPi = {
  signIn: (id: string) => demoUsers.find(user => user.id === id),
  release: (task: Task): Receipt => ({ id: `demo-${task.id}`, kind: 'demo' }),
}

let sdkReady: Promise<PiSdk> | undefined
export function canUsePi() {
  return Boolean(window.Pi) || /PiBrowser/i.test(navigator.userAgent) ||
    document.referrer.startsWith('https://sandbox.minepi.com/') ||
    import.meta.env.VITE_PI_SHOW_SANDBOX === 'true'
}

function loadSdk() {
  sdkReady ??= new Promise<PiSdk>((resolve, reject) => {
    const ready = () => {
      if (!window.Pi) return reject(new Error('The Pi SDK is unavailable. Try Demo mode.'))
      window.Pi.init({ version: '2.0', sandbox: true })
      resolve(window.Pi)
    }
    if (window.Pi) return ready()
    const script = document.createElement('script')
    const failed = () => {
      script.remove()
      reject(new Error('The Pi SDK could not be loaded. Try Demo mode.'))
    }
    const timeout = window.setTimeout(failed, 6000)
    script.src = 'https://sdk.minepi.com/pi-sdk.js'
    script.onload = () => { window.clearTimeout(timeout); ready() }
    script.onerror = () => { window.clearTimeout(timeout); failed() }
    document.head.append(script)
  }).catch(error => { sdkReady = undefined; throw error })
  return sdkReady
}

export async function signInPi(onIncomplete: (payment: IncompletePayment) => void): Promise<Session> {
  const sdk = await loadSdk()
  const incomplete: IncompletePayment[] = []
  let authenticated = false
  const auth = await sdk.authenticate(['username', 'payments'], payment => {
    if (authenticated) onIncomplete(payment)
    else incomplete.push(payment)
  })
  authenticated = true
  return { user: { id: auth.user.uid, name: auth.user.username }, accessToken: auth.accessToken, incomplete }
}

async function request(path: 'status' | 'approve' | 'complete', token?: string, data?: unknown) {
  let response: Response
  try {
    response = await fetch(`/api/pi/${path}`, token ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    } : undefined)
  } catch {
    throw new Error('The sandbox payment server is unavailable.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || !body) throw new Error(body?.error || 'The sandbox payment server is unavailable.')
  return body
}

export async function recoverPayment(task: Task, token: string, payment: IncompletePayment): Promise<Receipt> {
  if (!payment.transaction?.txid) throw new Error('This payment has no submitted transaction.')
  return complete(task, token, payment.identifier, payment.transaction.txid)
}

async function complete(task: Task, token: string, id: string, txid: string): Promise<Receipt> {
  const result = await request('complete', token, { id, txid, amount: task.reward, taskId: task.id })
  if (result.mode !== 'testnet' || result.id !== id) throw new Error('No verified Testnet receipt was returned.')
  return { id, kind: 'testnet' }
}

export async function releaseInPi(task: Task, token: string, onProgress: (message: string) => void): Promise<Receipt> {
  if ((await request('status')).mode !== 'testnet') {
    throw new Error('Testnet payments are disabled until a sandbox Server API key is configured. Demo rewards remain available.')
  }
  const sdk = await loadSdk()
  return new Promise((resolve, reject) => {
    let completing = false
    sdk.createPayment({ amount: task.reward, memo: `Pi Tasks reward: ${task.title}`, metadata: { taskId: task.id } }, {
      onReadyForServerApproval: async id => {
        try {
          await request('approve', token, { id, amount: task.reward, taskId: task.id })
        } catch (error) {
          onProgress(`Waiting for Testnet approval: ${(error as Error).message}`)
        }
      },
      onReadyForServerCompletion: async (id, txid) => {
        if (completing) return
        completing = true
        try {
          resolve(await complete(task, token, id, txid))
        } catch (error) {
          onProgress(`Waiting for Testnet confirmation: ${(error as Error).message}`)
        } finally {
          completing = false
        }
      },
      onCancel: () => reject(new Error('Payment cancelled; the reward was not released.')),
      onError: error => reject(new Error(error.message || 'Testnet payment failed.')),
    })
  })
}
