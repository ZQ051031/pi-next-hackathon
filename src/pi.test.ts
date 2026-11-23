import { afterEach, expect, it, vi } from 'vitest'
import { recoverPayment, releaseInPi, signInPi } from './pi'
import { createTask } from './tasks'

afterEach(() => vi.unstubAllGlobals())

it('uses sandbox auth scopes, recovers existing funding, and drives the SDK payment callbacks', async () => {
  const user = { uid: 'pi-user', username: 'pi.tester' }
  const txid = 'a'.repeat(64)
  const task = createTask({
    title: 'Build a tiny tool', description: 'Build a tiny tool for our meetup.', category: 'Development',
    reward: 7.5, deadline: '2027-01-02',
  }, { id: user.uid, name: user.username }, 'task-1', Date.parse('2027-01-01'))
  const existing = { identifier: 'existing', metadata: { taskId: task.id }, transaction: { txid } }
  const init = vi.fn()
  window.Pi = {
    init,
    authenticate: async (scopes, onIncomplete) => {
      expect(scopes).toEqual(['username', 'payments'])
      onIncomplete(existing)
      return { user, accessToken: 'test-token' }
    },
    createPayment: (intent, callbacks) => {
      expect(intent).toEqual({ amount: task.reward, memo: 'Pi Tasks reward: Build a tiny tool', metadata: { taskId: task.id } })
      callbacks.onReadyForServerApproval('new-payment')
      callbacks.onReadyForServerCompletion('new-payment', txid)
    },
  }
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ mode: 'testnet' })
    const request = JSON.parse(String(options?.body))
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-token' })
    expect(request).toMatchObject({ taskId: task.id, amount: task.reward })
    if (url.endsWith('/complete')) expect(request.txid).toBe(txid)
    return Response.json({ mode: 'testnet', id: request.id })
  })
  vi.stubGlobal('fetch', fetchMock)

  const session = await signInPi(vi.fn())
  expect(init).toHaveBeenCalledWith({ version: '2.0', sandbox: true })
  expect(session.user).toEqual({ id: user.uid, name: user.username })
  expect(session.incomplete).toEqual([existing])
  expect(await recoverPayment(task, session.accessToken, existing)).toEqual({ id: 'existing', kind: 'testnet' })
  expect(await releaseInPi(task, session.accessToken, vi.fn())).toEqual({ id: 'new-payment', kind: 'testnet' })
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/pi/complete', '/api/pi/status', '/api/pi/approve', '/api/pi/complete'])
  delete window.Pi
})
