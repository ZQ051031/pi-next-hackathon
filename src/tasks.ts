export const categories = ['Design', 'Development', 'Writing', 'Research', 'Community'] as const
export type Category = (typeof categories)[number]
export type User = { id: string; name: string }
export type Status = 'open' | 'claimed' | 'submitted' | 'funded' | 'paid'
export type Receipt = { id: string; kind: 'demo' | 'testnet' }
export type Draft = { title: string; description: string; category: Category; reward: number; deadline: string }
export type Task = Draft & {
  id: string
  poster: User
  claimer?: User
  createdAt: number
  status: Status
  submission?: string
  receipt?: Receipt
}

export const isReward = (reward: number) =>
  Number.isFinite(reward) && reward > 0 && reward <= 10_000 && Number(reward.toFixed(7)) === reward

export function endOfDeadline(deadline: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return NaN
  const date = new Date(`${deadline}T23:59:59.999Z`)
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === deadline ? +date : NaN
}

export function createTask(draft: Draft, poster: User, id: string, now = Date.now()): Task {
  const title = draft.title.trim()
  const description = draft.description.trim()
  if (title.length < 4 || title.length > 80) throw new Error('Enter a title between 4 and 80 characters.')
  if (description.length < 12 || description.length > 2000) throw new Error('Enter a description between 12 and 2,000 characters.')
  if (!categories.includes(draft.category)) throw new Error('Choose a category.')
  if (!isReward(draft.reward)) throw new Error('Enter a reward greater than 0 and up to 10,000 Pi (7 decimal places maximum).')
  if (!(endOfDeadline(draft.deadline) >= now)) throw new Error('Choose a deadline that has not passed (UTC).')
  return { ...draft, title, description, id, poster, status: 'open', createdAt: now }
}

export function claimTask(task: Task, user: User, now = Date.now()): Task {
  if (task.status !== 'open') throw new Error('This task is no longer open.')
  if (task.poster.id === user.id) throw new Error('You cannot claim your own task.')
  if (endOfDeadline(task.deadline) < now) throw new Error('The claim deadline has passed.')
  return { ...task, status: 'claimed', claimer: user }
}

export function submitTask(task: Task, user: User, submission: string): Task {
  if (task.status !== 'claimed' || task.claimer?.id !== user.id) throw new Error('Only the claimer can submit this task.')
  const work = submission.trim()
  if (!work || work.length > 2000) throw new Error('Enter a completion note or link (up to 2,000 characters).')
  return { ...task, status: 'submitted', submission: work }
}

export function assertCanRelease(task: Task, user: User) {
  if (task.poster.id !== user.id || task.status !== 'submitted' || !task.claimer) {
    throw new Error('Only the poster can release a reward after work is submitted.')
  }
}

export function recordFunding(task: Task, user: User, receipt: Receipt): Task {
  assertCanRelease(task, user)
  if (!receipt.id || (receipt.kind !== 'demo' && receipt.kind !== 'testnet')) throw new Error('Missing payment confirmation.')
  return { ...task, status: receipt.kind === 'demo' ? 'paid' : 'funded', receipt }
}

export function simulatePayout(task: Task, user: User): Task {
  if (task.poster.id !== user.id || task.status !== 'funded' || task.receipt?.kind !== 'testnet') {
    throw new Error('A confirmed Testnet payment is required before simulating a payout.')
  }
  return { ...task, status: 'paid' }
}

export function filterTasks(tasks: Task[], options: {
  query: string
  category: Category | 'All'
  status: Status | 'all'
  sort: 'newest' | 'reward' | 'deadline'
}, now = Date.now()) {
  const words = options.query.toLowerCase().trim().split(/\s+/)
  return tasks.filter(task => {
    const text = [task.title, task.description, task.category, task.poster.name].join(' ').toLowerCase()
    return words.every(word => text.includes(word)) &&
      (options.category === 'All' || options.category === task.category) &&
      (options.status === 'all' || (options.status === task.status &&
        (task.status !== 'open' || endOfDeadline(task.deadline) >= now)))
  }).sort((a, b) => {
    if (options.sort === 'reward') return b.reward - a.reward || b.createdAt - a.createdAt
    if (options.sort === 'deadline') return endOfDeadline(a.deadline) - endOfDeadline(b.deadline) || b.createdAt - a.createdAt
    return b.createdAt - a.createdAt
  })
}

export function profileFor(tasks: Task[], user: User) {
  const posted = tasks.filter(task => task.poster.id === user.id)
  const claimed = tasks.filter(task => task.claimer?.id === user.id)
  const completed = claimed.filter(task => task.status === 'paid')
  return { posted, claimed, completed, reputation: completed.length }
}
