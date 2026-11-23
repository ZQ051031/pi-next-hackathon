import { demoUsers } from './pi'
import { createTask } from './tasks'
import type { Draft } from './tasks'

export type Mode = 'demo' | 'sandbox'
export const storageKey = (mode: Mode) => `pi-tasks-v1-${mode}`

const examples: (Omit<Draft, 'deadline'> & { days: number })[] = [
  { category: 'Design', title: 'Design a sticker pack for a community meetup', description: 'Create three playful sticker concepts for a local community event. Deliver them as SVGs with a short note about your inspiration.', reward: 8, days: 7 },
  { category: 'Development', title: 'Build a tiny accessible countdown widget', description: 'Build a lightweight HTML and CSS countdown component with keyboard-friendly controls and a clear empty state.', reward: 15, days: 11 },
  { category: 'Writing', title: 'Write a friendly onboarding checklist', description: 'Draft a five-step checklist that helps new volunteers feel ready for their first shift. Keep the tone warm and practical.', reward: 6, days: 5 },
  { category: 'Research', title: 'Find free tools for local event organizers', description: 'Compare five free tools for organizing small, in-person events. Include pricing limits and one clear recommendation.', reward: 12, days: 14 },
  { category: 'Community', title: 'Suggest icebreakers for an online meetup', description: 'Collect four quick activities a host could run with a group of ten. Include estimated time and any materials needed.', reward: 4.5, days: 9 },
  { category: 'Design', title: 'Create an accessible color palette', description: 'Propose a six-color palette for a community garden website. Include contrast ratios for text and buttons.', reward: 10, days: 18 },
]

export function loadBoard(mode: Mode) {
  try {
    const saved = localStorage.getItem(storageKey(mode))
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed as ReturnType<typeof createTask>[]
    }
  } catch {
    // A blocked or unavailable store still allows the current session to work.
  }
  if (mode === 'sandbox') return []
  const now = Date.now()
  return examples.map(({ days, ...draft }, index) => createTask({
    ...draft,
    deadline: new Date(now + days * 86_400_000).toISOString().slice(0, 10),
  }, demoUsers[index % demoUsers.length], `example-${index + 1}`, now - index * 60_000))
}
