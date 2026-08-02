import type { PassagePart } from '../types'

export interface Passage {
  id: string
  title: string
  parts: PassagePart[]
}

export const CUSTOM_PASSAGE_ID = 'custom'

function t(text: string): PassagePart {
  return { type: 'text', text }
}
function pw(text: string): PassagePart {
  return { type: 'power', text }
}
function dc(text: string): PassagePart {
  return { type: 'diction', text }
}
function pause(seconds: number): PassagePart {
  return { type: 'pause', seconds }
}

/** Flattens a passage into plain, speakable text — pause markers carry no characters. */
export function passagePlainText(parts: PassagePart[]): string {
  return parts
    .map((p) => (p.type === 'pause' ? '' : p.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

export function passageWordCount(parts: PassagePart[]): number {
  const text = passagePlainText(parts)
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

export function passageDesignatedPauses(parts: PassagePart[]): number[] {
  return parts.filter((p): p is Extract<PassagePart, { type: 'pause' }> => p.type === 'pause').map((p) => p.seconds)
}

export function passageDictionWords(parts: PassagePart[]): string[] {
  return parts
    .filter((p): p is Extract<PassagePart, { type: 'diction' }> => p.type === 'diction')
    .map((p) => p.text.replace(/[^a-zA-Z']/g, '').toLowerCase())
    .filter(Boolean)
}

export const PASSAGES: Passage[] = [
  {
    id: 'boardroom',
    title: 'The Boardroom Opener',
    parts: [
      t('I want to start by naming the elephant in the room.'),
      pause(1),
      t(' Our numbers this quarter were '),
      pw('not'),
      t(' what we '),
      dc('projected'),
      t('.'),
      pause(1),
      t(' That is on us,'),
      pause(0.5),
      t(' and I am '),
      pw('not'),
      t(' going to spend the next ten minutes '),
      dc('explaining'),
      t(' why.'),
      pause(1),
      t(' What I want to walk you through is '),
      pw('exactly'),
      t(' what we are changing,'),
      pause(0.5),
      t(' starting '),
      pw('today'),
      t(','),
      pause(0.5),
      t(' and why I am '),
      pw('confident'),
      t(' it works.'),
      pause(1),
      t(' I do '),
      pw('not'),
      t(' need you to '),
      pw('trust'),
      t(' the plan yet.'),
      pause(1.5),
      t(' I need you to '),
      pw('trust'),
      t(' that we see the problem '),
      dc('clearly'),
      t('.'),
    ],
  },
  {
    id: 'difficult-conversation',
    title: 'The Hard Team Conversation',
    parts: [
      t('I asked you here because I care about your growth on this team,'),
      pause(0.5),
      t(' and that means being '),
      pw('direct'),
      t(' with you.'),
      pause(1),
      t(' The last two deadlines slipped,'),
      pause(0.5),
      t(' and the team '),
      dc('absorbed'),
      t(' the cost '),
      dc('quietly'),
      t('.'),
      pause(1),
      t(' That '),
      pw('stops'),
      t(' '),
      pw('today'),
      t('.'),
      pause(1.5),
      t(' I am '),
      pw('not'),
      t(' here to assign blame.'),
      pause(1),
      t(' I am here to reset '),
      dc('expectations'),
      t(' and make sure you have what you need to hit the next one.'),
      pause(1),
      t(' What is '),
      pw('actually'),
      t(' getting in your way?'),
    ],
  },
  {
    id: 'investor-pitch',
    title: 'The Investor Pitch',
    parts: [
      t('Every founder in this room will tell you their market is big.'),
      pause(1),
      t(' I am going to show you ours is '),
      pw('inevitable'),
      t('.'),
      pause(1.5),
      t(' Three years ago this problem was a nice-to-have.'),
      pause(1),
      t(' '),
      pw('Today'),
      t(' it is the reason our last two '),
      dc('customers'),
      t(' almost went out of business.'),
      pause(1),
      t(' We did '),
      pw('not'),
      t(' invent the urgency.'),
      pause(1),
      t(' We just built the '),
      pw('only'),
      t(' product ready for it.'),
      pause(1),
      t(' Let me show you the number that made our first '),
      dc('investor'),
      t(' stop taking notes and start asking '),
      dc('questions'),
      t('.'),
    ],
  },
  {
    id: 'calm-under-fire',
    title: 'Calm Under Fire',
    parts: [
      t('I understand you are '),
      dc('frustrated'),
      t(','),
      pause(0.5),
      t(' and you have '),
      pw('every'),
      t(' right to be.'),
      pause(1),
      t(' Here is what I know right now,'),
      pause(0.5),
      t(' and here is what I am still '),
      dc('confirming'),
      t('.'),
      pause(1),
      t(' I will '),
      pw('not'),
      t(' guess in front of you.'),
      pause(1.5),
      t(' Give me the next fifteen minutes,'),
      pause(0.5),
      t(' and I will come back with a '),
      pw('real'),
      t(' answer '),
      dc('instead'),
      t(' of a comfortable one.'),
      pause(1),
      t(' That is what you '),
      pw('actually'),
      t(' need from me '),
      pw('today'),
      t('.'),
    ],
  },
]
