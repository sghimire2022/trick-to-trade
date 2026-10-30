import type { LevelConfigWithSimulation } from './types'

export const level3: LevelConfigWithSimulation = {
  id: 'level-3-market-making',
  title: 'Market Making',
  goal: 'Quote both sides of the book and earn the spread — watch your PnL and inventory as noise traders hit your quotes.',
  roundDurationSeconds: 90,
  playerParticipantId: 'player',
  simulation: {
    seed: 42,
    playerLatency: { kind: 'fixed', delay: 0 },
    tickIntervalSimTime: 1,
    realTimeMsPerTick: 300,
    noiseTraders: [
      {
        config: {
          participantId: 'noise-1',
          actionProbability: 0.35,
          minQty: 1,
          maxQty: 4,
          maxOffset: 4,
          fallbackPrice: 100,
        },
        latency: { kind: 'fixed', delay: 2 },
        rngSeed: 101,
      },
      {
        config: {
          participantId: 'noise-2',
          actionProbability: 0.3,
          minQty: 1,
          maxQty: 5,
          maxOffset: 5,
          fallbackPrice: 100,
        },
        latency: { kind: 'fixed', delay: 2 },
        rngSeed: 202,
      },
    ],
  },
}
