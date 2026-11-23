import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { loadBoard, storageKey } from './board'
import type { Mode } from './board'
import { canUsePi, demoUsers, mockPi, recoverPayment, releaseInPi, signInPi } from './pi'
import type { IncompletePayment } from './pi'
import {
  assertCanRelease, categories, claimTask, createTask, endOfDeadline, filterTasks, profileFor,
  recordFunding, simulatePayout, submitTask,
} from './tasks'
import type { Category, Draft, Status, Task, User } from './tasks'

const statusNames: Record<Status, string> = {
  open: 'Open', claimed: 'Claimed', submitted: 'Submitted', funded: 'Testnet funded', paid: 'Demo paid',
}
const marks: Record<Category, string> = { Design: '✧', Development: '⌘', Writing: '✎', Research: '◈', Community: '◇' }
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const rewardFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 7 })
const formatDate = (task: Task) => dateFormat.format(endOfDeadline(task.deadline))
const taskStatus = (task: Task) => task.status === 'open' && endOfDeadline(task.deadline) < Date.now()
  ? 'Expired'
  : statusNames[task.status]

function Reward({ amount }: { amount: number }) {
  return <span className="reward"><span aria-hidden="true">✦</span> {rewardFormat.format(amount)} Pi</span>
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <article className="task-card">
      <div className="card-top"><span className="category"><i aria-hidden="true">{marks[task.category]}</i>{task.category}</span><Reward amount={task.reward} /></div>
      <h3><button className="title-link" onClick={onOpen}>{task.title}</button></h3>
      <p>{task.description}</p>
      <div className="card-meta"><span>@{task.poster.name}</span><span>Due {formatDate(task)}</span></div>
      <div className="card-bottom"><span className={'status ' + task.status}>{taskStatus(task)}</span><button className="text-button" onClick={onOpen} aria-label={`View task: ${task.title}`}>View task <span aria-hidden="true">↗</span></button></div>
    </article>
  )
}

function TaskForm({ onPost }: { onPost: (draft: Draft) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onPost({
      title: String(data.get('title')), description: String(data.get('description')),
      category: data.get('category') as Category, reward: Number(data.get('reward')), deadline: String(data.get('deadline')),
    })
  }
  return (
    <section className="panel narrow">
      <p className="eyebrow">New bounty</p>
      <h1>Post a task</h1>
      <p>Describe a small, specific job. Posting a reward does not reserve or transfer any Pi.</p>
      <form onSubmit={submit}>
        <label>Title<input name="title" required minLength={4} maxLength={80} placeholder="What needs to get done?" /></label>
        <label>Description<textarea name="description" required minLength={12} maxLength={2000} rows={5} placeholder="Describe the deliverable and what good work looks like." /></label>
        <div className="form-row">
          <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Reward (Pi)<input name="reward" type="number" min="0.0000001" max="10000" step="0.0000001" placeholder="5" required /></label>
          <label>Claim deadline (UTC)<input name="deadline" type="date" min={new Date().toISOString().slice(0, 10)} required /></label>
        </div>
        <button className="button primary" type="submit">Publish task</button>
      </form>
    </section>
  )
}

function Profile({ user, tasks, onOpen }: { user: User; tasks: Task[]; onOpen: (id: string) => void }) {
  const profile = profileFor(tasks, user)
  const group = (title: string, list: Task[]) => (
    <section className="profile-group"><h2>{title} <span>{list.length}</span></h2>
      {list.length ? <ul>{list.map(task => <li key={task.id}><button className="title-link" onClick={() => onOpen(task.id)}>{task.title}</button><span className={'status ' + task.status}>{taskStatus(task)}</span></li>)}</ul>
        : <p>Nothing to show yet.</p>}
    </section>
  )
  return (
    <section className="panel narrow">
      <p className="eyebrow">Pioneer profile</p><h1>@{user.name}</h1>
      <p><strong>{profile.reputation} reputation {profile.reputation === 1 ? 'point' : 'points'}</strong> · 1 point per completed task with a demo payout.</p>
      {group('Posted tasks', profile.posted)}
      {group('Claimed tasks', profile.claimed)}
      {group('Completed work', profile.completed)}
    </section>
  )
}

type View = 'board' | 'post' | 'task' | 'profile' | 'privacy' | 'terms'

export default function App() {
  const [mode, setMode] = useState<Mode>('demo')
  const [tasks, setTasks] = useState(() => loadBoard('demo'))
  const [user, setUser] = useState<User>()
  const [accessToken, setAccessToken] = useState('')
  const [incomplete, setIncomplete] = useState<IncompletePayment[]>([])
  const [view, setView] = useState<View>('board')
  const [selected, setSelected] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [sort, setSort] = useState<'newest' | 'reward' | 'deadline'>('newest')
  const [storageWarning, setStorageWarning] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(storageKey(mode), JSON.stringify(tasks)); setStorageWarning(false) }
    catch { setStorageWarning(true) }
  }, [mode, tasks])

  function navigate(next: View) { setView(next); setMessage('') }
  function openTask(id: string) { setSelected(id); navigate('task') }
  function replace(next: Task) { setTasks(current => current.map(task => task.id === next.id ? next : task)) }
  function apply(change: () => Task) {
    try { replace(change()); setMessage('') }
    catch (error) { setMessage((error as Error).message) }
  }
  function connectDemo(id: string) {
    if (mode !== 'demo') { setTasks(loadBoard('demo')); navigate('board') }
    setMode('demo'); setUser(mockPi.signIn(id)); setAccessToken(''); setIncomplete([]); setAccountOpen(false); setMessage('')
  }
  async function connectPi() {
    setBusy(true); setMessage('')
    try {
      const enqueue = (payment: IncompletePayment) => setIncomplete(items => items.some(item => item.identifier === payment.identifier) ? items : [...items, payment])
      const next = await signInPi(enqueue)
      if (mode !== 'sandbox') { setTasks(loadBoard('sandbox')); navigate('board') }
      setMode('sandbox'); setUser(next.user); setAccessToken(next.accessToken)
      next.incomplete.forEach(enqueue)
      setAccountOpen(false)
    } catch { setMessage('Pi sign-in did not complete. Open the configured Pi Sandbox URL or choose a demo account.') }
    finally { setBusy(false) }
  }
  function signOut() {
    setUser(undefined); setAccessToken(''); setIncomplete([]); setAccountOpen(false)
    navigate('board')
  }
  function post(draft: Draft) {
    if (!user) return
    try {
      const task = createTask(draft, user, crypto.randomUUID())
      setTasks(current => [task, ...current]); openTask(task.id)
    } catch (error) { setMessage((error as Error).message) }
  }
  async function release(task: Task) {
    if (!user || busy) return
    setBusy(true); setMessage('')
    try {
      assertCanRelease(task, user)
      if (mode === 'sandbox' && incomplete.length) throw new Error('Recover the previous Testnet payment before starting a new one.')
      const receipt = mode === 'demo' ? mockPi.release(task) : await releaseInPi(task, accessToken, setMessage)
      replace(recordFunding(task, user, receipt))
      setMessage(receipt.kind === 'demo' ? 'Demo reward released. No Pi was transferred.' : 'Funding confirmed in Testnet. The claimer payout is not an on-chain transfer.')
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  async function recover(payment: IncompletePayment) {
    if (!user || busy) return
    setBusy(true); setMessage('')
    try {
      const task = tasks.find(item => item.id === payment.metadata?.taskId)
      if (!task) throw new Error('This task is not stored in this browser. Recover from the browser where the task was posted.')
      if (task.receipt?.id !== payment.identifier) {
        assertCanRelease(task, user)
        replace(recordFunding(task, user, await recoverPayment(task, accessToken, payment)))
      }
      setIncomplete(items => items.filter(item => item.identifier !== payment.identifier))
      openTask(task.id)
      setMessage('Existing Testnet payment recovered without charging again.')
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }

  const task = tasks.find(item => item.id === selected)
  const visibleTasks = filterTasks(tasks, { query, category, status, sort })
  const openCount = filterTasks(tasks, { query: '', category: 'All', status: 'open', sort: 'newest' }).length
  const requireUser = (next: View) => user ? navigate(next) : setAccountOpen(true)
  let content: ReactNode

  if (view === 'post' && user) content = <TaskForm onPost={post} />
  else if (view === 'profile' && user) content = <Profile user={user} tasks={tasks} onOpen={openTask} />
  else if (view === 'privacy') content = <section className="panel narrow"><h1>Privacy policy</h1><p>Tasks, submissions, public handles, and receipt IDs are stored in this browser. They are not published to a shared database. Clear this site’s browser storage to remove them.</p><p>Demo mode never connects to Pi. Optional sandbox sign-in sends the necessary access token to the payment server for account verification; it is kept only in memory by the app. Pi processes sandbox transactions. Do not enter sensitive information in tasks or submissions.</p></section>
  else if (view === 'terms') content = <section className="panel narrow"><h1>Terms of use</h1><p>This prototype is for lawful micro-tasks and testing only. Do not post private information or content you cannot share. Rewards are not escrowed. Demo payouts are simulations, and Testnet Pi has no Mainnet value.</p><p>Do not use this prototype to arrange work that depends on a real payment. Pi Tasks is independent and is not endorsed by Pi Network.</p></section>
  else if (view === 'task' && task) {
    const expired = endOfDeadline(task.deadline) < Date.now()
    content = (
      <article className="panel narrow">
        <button className="text-button" onClick={() => navigate('board')}>← Back to board</button>
        <div className="detail-meta"><span className={'status ' + task.status}>{taskStatus(task)}</span><span>{task.category}</span><Reward amount={task.reward} /></div>
        <h1>{task.title}</h1><p className="prose">{task.description}</p>
        <dl><div><dt>Posted by</dt><dd>@{task.poster.name}</dd></div><div><dt>Claim deadline</dt><dd>{formatDate(task)} (UTC)</dd></div>{task.claimer && <div><dt>Claimed by</dt><dd>@{task.claimer.name}</dd></div>}</dl>
        {task.submission && <div className="work"><h2>Submitted work</h2><p className="prose">{task.submission}</p></div>}
        {task.status === 'open' && !expired && (!user
          ? <button className="button primary" onClick={() => setAccountOpen(true)}>Sign in to claim</button>
          : task.poster.id !== user.id && <button className="button primary" onClick={() => apply(() => claimTask(task, user))}>Claim task</button>)}
        {task.status === 'claimed' && user?.id === task.claimer?.id && user && (
          <form key={task.id} onSubmit={event => {
            event.preventDefault()
            const note = String(new FormData(event.currentTarget).get('work'))
            apply(() => submitTask(task, user, note))
          }}>
            <label>Completion note or link<textarea name="work" required maxLength={2000} rows={3} /></label>
            <button className="button primary">Mark complete</button>
          </form>
        )}
        {task.status === 'submitted' && user?.id === task.poster.id && <>
          <p>{mode === 'demo' ? 'Releasing this reward simulates the payment to the claimer.' : 'Funding opens a user-to-app Testnet payment. It does not send Pi to the claimer.'}</p>
          <button className="button primary" disabled={busy} onClick={() => void release(task)}>{mode === 'demo' ? 'Release demo reward' : 'Fund reward with Testnet Pi'}</button>
        </>}
        {task.status === 'funded' && user?.id === task.poster.id && <button className="button primary" onClick={() => apply(() => simulatePayout(task, user))}>Simulate claimer payout</button>}
        {task.receipt && <p className="receipt">{task.receipt.kind === 'demo' ? 'Simulated reward' : 'User-to-app Testnet funding'} · {task.receipt.id}</p>}
      </article>
    )
  } else content = (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true">✦</span> The Pi bounty board</p>
          <h1>Small tasks.<br /><em>Real impact.</em></h1>
          <p>Get the little things done. Post a bounty, put your skills to work, and reward contributions in Pi.</p>
          <div className="hero-actions">
            <a className="button lime" href="#board">Explore tasks <span aria-hidden="true">↓</span></a>
            <button className="button outline" onClick={() => requireUser('post')}><span aria-hidden="true">+</span> Post a task</button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-card"><span>◎ &nbsp; BOUNTY BOARD</span><div><i>✓</i><b /></div><div><i>✓</i><b /></div><div><i>✓</i><b /></div></div>
          <span className="spark one">✦</span><span className="spark two">✧</span><span className="spark three">✦</span>
        </div>
      </section>
      <section className="board" id="board">
        <div className="board-heading"><div><p className="eyebrow">Find your next contribution</p><h2>Task board</h2></div><span className="board-count">{openCount} open {openCount === 1 ? 'bounty' : 'bounties'}</span></div>
        <div className="filters">
          <label className="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input aria-label="Search tasks" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for a task…" /></label>
          <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option>{Object.entries(statusNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
          <select aria-label="Sort tasks" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="reward">Highest reward</option><option value="deadline">Soonest deadline</option></select>
        </div>
        <div className="chips" aria-label="Filter by category">{(['All', ...categories] as const).map(item => <button className="chip" key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{item === 'All' ? 'All categories' : item}</button>)}</div>
        {visibleTasks.length ? <div className="task-grid">{visibleTasks.map(item => <TaskCard key={item.id} task={item} onOpen={() => openTask(item.id)} />)}</div>
          : <div className="panel empty"><h3>No tasks to show</h3><p>{tasks.length ? 'Try adjusting the search or filters.' : 'Post a bounty to start this browser’s sandbox board.'}</p></div>}
      </section>
    </>
  )

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <nav className="shell nav" aria-label="Main navigation">
          <button className="brand" onClick={() => navigate('board')}><img src="/logo.svg" alt="Pi Tasks" /></button>
          <button className="nav-board text-button" aria-current={view === 'board' ? 'page' : undefined} onClick={() => navigate('board')}>Task board</button>
          <div className="nav-right">
            <span className="mode"><i />{mode === 'demo' ? 'Demo mode' : 'Pi Sandbox'}</span>
            {user && <button className="text-button" onClick={() => navigate('profile')}>My profile</button>}
            <button className="button account" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)} disabled={busy}>{user ? `@${user.name}` : 'Sign in'} <span aria-hidden="true">⌄</span></button>
          </div>
        </nav>
      </header>
      <main className="shell main" id="main">
        {accountOpen && <section className="account-panel panel" aria-label="Sign in options">
          <h2>{user ? 'Switch account' : 'Sign in to Pi Tasks'}</h2>
          <p>Demo accounts share this local board. No Pi account or wallet is needed.</p>
          <div className="account-options">{demoUsers.map(option => <button className="button account" key={option.id} disabled={busy} onClick={() => connectDemo(option.id)}>Demo: @{option.name}</button>)}
            {canUsePi() && <button className="button primary" disabled={busy} onClick={() => void connectPi()}>Sign in with Pi</button>}
            {user && <button className="text-button" disabled={busy} onClick={signOut}>Sign out</button>}
          </div>
        </section>}
        {storageWarning && <p role="status" className="notice">Browser storage is unavailable; changes may be lost when you leave.</p>}
        {message && <p role="status" className="notice">{message}</p>}
        {mode === 'sandbox' && incomplete.map(payment => <div className="notice" key={payment.identifier}>A previous Testnet payment needs confirmation. <button className="text-button" disabled={busy} onClick={() => void recover(payment)}>Recover payment</button></div>)}
        {content}
      </main>
      <footer className="shell footer"><span>Pi Tasks · {mode === 'demo' ? 'Simulated rewards' : 'Testnet only'}</span><div><button className="text-button" onClick={() => navigate('privacy')}>Privacy</button><button className="text-button" onClick={() => navigate('terms')}>Terms</button></div></footer>
    </>
  )
}
