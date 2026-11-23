import { describe, expect, it } from 'vitest'
import { assertCanRelease, claimTask, createTask, filterTasks, profileFor, recordFunding, simulatePayout, submitTask } from './tasks'
import type { Draft } from './tasks'

const poster = { id: 'a', name: 'avery' }
const claimer = { id: 'b', name: 'blair' }
const stranger = { id: 'c', name: 'charlie' }
const now = Date.parse('2027-01-01T12:00:00Z')
const draft: Draft = { title: '  Design a map  ', description: '  A clean trail map for the park.  ', category: 'Design', reward: 5, deadline: '2027-01-02' }
const task = createTask(draft, poster, 'map', now)
const claimed = claimTask(task, claimer, now)
const submitted = submitTask(claimed, claimer, '  Trail map finished.  ')

describe('task validation', () => {
  it('normalizes text and supports the smallest Pi denomination', () => {
    expect(createTask({ ...draft, reward: 0.0000001 }, poster, 'map', now)).toMatchObject({
      title: 'Design a map', description: 'A clean trail map for the park.', status: 'open', reward: 0.0000001,
    })
  })
  it.each([
    ['blank title', { title: '    ' }], ['short description', { description: 'short' }],
    ['zero reward', { reward: 0 }], ['infinite reward', { reward: Infinity }], ['excessive precision', { reward: 0.00000001 }],
    ['invalid calendar date', { deadline: '2027-02-30' }], ['past deadline', { deadline: '2026-12-31' }],
  ])('rejects %s', (_name, change) => {
    expect(() => createTask({ ...draft, ...change }, poster, 'map', now)).toThrow()
  })
})

describe('task and payment transitions', () => {
  it('lets a second account claim only open unexpired work', () => {
    expect(claimed).toMatchObject({ claimer, status: 'claimed' })
    expect(task.status).toBe('open')
    expect(() => claimTask(task, poster, now)).toThrow('your own')
    expect(() => claimTask(claimed, stranger, now)).toThrow('no longer open')
    expect(claimTask(task, claimer, Date.parse('2027-01-02T23:59:59Z')).status).toBe('claimed')
    expect(() => claimTask(task, claimer, Date.parse('2027-01-03T00:00:00Z'))).toThrow('deadline')
  })
  it('only lets a claimer submit meaningful work', () => {
    expect(() => submitTask(claimed, stranger, 'not mine')).toThrow('Only the claimer')
    expect(() => submitTask(claimed, claimer, ' ')).toThrow('completion note')
    expect(submitted).toMatchObject({ status: 'submitted', submission: 'Trail map finished.' })
  })
  it('requires the poster, a submission, and a confirmation for a demo payout', () => {
    expect(() => assertCanRelease(claimed, poster)).toThrow('after work is submitted')
    expect(() => assertCanRelease(submitted, stranger)).toThrow('Only the poster')
    expect(() => recordFunding(submitted, poster, { kind: 'demo', id: '' })).toThrow('confirmation')
    const paid = recordFunding(submitted, poster, { kind: 'demo', id: 'demo-map' })
    expect(paid).toMatchObject({ status: 'paid', receipt: { kind: 'demo', id: 'demo-map' } })
    expect(() => recordFunding(paid, poster, { kind: 'demo', id: 'demo-map' })).toThrow('after work is submitted')
  })
  it('separates Testnet funding from the simulated payout and counts reputation only after payout', () => {
    const funded = recordFunding(submitted, poster, { kind: 'testnet', id: 'pi-payment' })
    expect(funded.status).toBe('funded')
    expect(profileFor([funded], claimer)).toMatchObject({ claimed: [funded], completed: [], reputation: 0 })
    expect(() => simulatePayout(funded, stranger)).toThrow()
    const paid = simulatePayout(funded, poster)
    expect(profileFor([paid], poster)).toMatchObject({ posted: [paid], reputation: 0 })
    expect(profileFor([paid], claimer)).toMatchObject({ completed: [paid], reputation: 1 })
  })
})

it('combines keyword, category and status filters and supports reward and deadline sorting', () => {
  const second = createTask({ ...draft, title: 'Build a map', category: 'Development', reward: 10, deadline: '2027-01-01' }, poster, 'second', now)
  const third = createTask({ ...draft, reward: 8 }, stranger, 'third', now)
  const all = { query: '', category: 'All', status: 'all', sort: 'reward' } as const
  expect(filterTasks([task, second, third], all, now)).toEqual([second, third, task])
  expect(filterTasks([task, second], { ...all, sort: 'deadline' }, now)).toEqual([second, task])
  expect(filterTasks([task, second, third], { ...all, category: 'Design', query: ' MAP  Avery ' }, now)).toEqual([task])
  expect(filterTasks([submitted, second, third], { ...all, status: 'open' }, Date.parse('2027-01-02'))).toEqual([third])
})
