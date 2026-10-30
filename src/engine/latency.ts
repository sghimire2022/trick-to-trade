import type { Rng } from './rng'
import type { Time } from './types'

/**
 * A participant's network/processing delay. `fixed` is a constant number of
 * simulated time units; `jitter` samples uniformly between `min` and `max`
 * (inclusive) each time, to model a bot or connection with variable latency.
 */
export type LatencyProfile =
  | { readonly kind: 'fixed'; readonly delay: Time }
  | { readonly kind: 'jitter'; readonly min: Time; readonly max: Time }

function assertValidProfile(profile: LatencyProfile): void {
  if (profile.kind === 'fixed') {
    if (!Number.isInteger(profile.delay) || profile.delay < 0) {
      throw new Error('Fixed latency delay must be a non-negative integer')
    }
    return
  }
  if (!Number.isInteger(profile.min) || !Number.isInteger(profile.max) || profile.min < 0 || profile.max < profile.min) {
    throw new Error('Jitter latency requires 0 <= min <= max, both integers')
  }
}

/**
 * Maps participants to how long their orders take to reach the matching
 * engine. This is what makes "the latency race" level concrete: a bot with a
 * shorter delay gets its cancels and re-quotes in sooner, so it reaches a
 * stale price first.
 *
 * Jittered delays are sampled from the level's seeded RNG — never a wall
 * clock — so a run with the same seed replays with the same delays.
 */
export class LatencyModel {
  private readonly profiles = new Map<string, LatencyProfile>()
  private readonly rng: Rng
  private readonly defaultProfile: LatencyProfile

  constructor(rng: Rng, defaultProfile: LatencyProfile = { kind: 'fixed', delay: 0 }) {
    assertValidProfile(defaultProfile)
    this.rng = rng
    this.defaultProfile = defaultProfile
  }

  /** Sets (or replaces) a participant's latency profile. */
  setProfile(participantId: string, profile: LatencyProfile): void {
    assertValidProfile(profile)
    this.profiles.set(participantId, profile)
  }

  /** Samples this participant's delay for their next action, in simulated time units. */
  delayFor(participantId: string): Time {
    const profile = this.profiles.get(participantId) ?? this.defaultProfile
    if (profile.kind === 'fixed') return profile.delay
    return this.rng.nextIntInRange(profile.min, profile.max + 1)
  }
}
