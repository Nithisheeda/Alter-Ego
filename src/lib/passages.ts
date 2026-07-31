export interface Passage {
  id: string
  title: string
  text: string
}

export const PASSAGES: Passage[] = [
  {
    id: 'boardroom',
    title: 'The Boardroom Opener',
    text: `I want to start by naming the elephant in the room. Our numbers this quarter were not what we projected. That is on us, and I am not going to spend the next ten minutes explaining why. What I want to walk you through is exactly what we are changing, starting today, and why I am confident it works. I do not need you to trust the plan yet. I need you to trust that we see the problem clearly.`,
  },
  {
    id: 'difficult-conversation',
    title: 'The Hard Team Conversation',
    text: `I asked you here because I care about your growth on this team, and that means being direct with you. The last two deadlines slipped, and the team absorbed the cost quietly. That stops today. I am not here to assign blame. I am here to reset expectations and make sure you have what you need to hit the next one. What is actually getting in your way?`,
  },
  {
    id: 'investor-pitch',
    title: 'The Investor Pitch',
    text: `Every founder in this room will tell you their market is big. I am going to show you ours is inevitable. Three years ago this problem was a nice-to-have. Today it is the reason our last two customers almost went out of business. We did not invent the urgency. We just built the only product ready for it. Let me show you the number that made our first investor stop taking notes and start asking questions.`,
  },
  {
    id: 'calm-under-fire',
    title: 'Calm Under Fire',
    text: `I understand you are frustrated, and you have every right to be. Here is what I know right now, and here is what I am still confirming. I will not guess in front of you. Give me the next fifteen minutes, and I will come back with a real answer instead of a comfortable one. That is what you actually need from me today.`,
  },
]
