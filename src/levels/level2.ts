import type { LevelConfig } from './types'

export const level2: LevelConfig = {
  id: 'level-2-getting-filled',
  title: 'Getting Filled',
  goal: "Join a queue at the same price as another order, then watch who gets filled first. First in line wins — that's price-time priority.",
  roundDurationSeconds: 90,
  playerParticipantId: 'player',
}
