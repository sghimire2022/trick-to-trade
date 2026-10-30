import type { LatencyProfile } from '../engine/latency'
import type { NoiseTraderConfig } from '../engine/bots/noiseTrader'
import type { Time } from '../engine/types'

export interface NoiseTraderRosterEntry {
  readonly config: NoiseTraderConfig
  readonly latency: LatencyProfile
  readonly rngSeed: number
}

/** How to run this level's continuous background simulation in a Web Worker. */
export interface SimulationRosterConfig {
  readonly seed: number
  readonly playerLatency: LatencyProfile
  readonly noiseTraders: readonly NoiseTraderRosterEntry[]
  /** How far simulated time advances per bot tick. */
  readonly tickIntervalSimTime: Time
  /** Real milliseconds between advancing the simulation. */
  readonly realTimeMsPerTick: number
}

export interface LevelConfig {
  readonly id: string
  readonly title: string
  /** 1–2 sentence goal shown in the level's intro. */
  readonly goal: string
  readonly roundDurationSeconds: number
  readonly playerParticipantId: string
  /** Present only for levels that run bots continuously in a Web Worker. */
  readonly simulation?: SimulationRosterConfig
}

/** A level that's guaranteed to have a bot roster, for levels that need it to typecheck without a guard. */
export type LevelConfigWithSimulation = LevelConfig & { readonly simulation: SimulationRosterConfig }
