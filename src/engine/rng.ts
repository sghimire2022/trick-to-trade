/**
 * Seeded pseudo-random number generator (mulberry32). Not cryptographic —
 * just small, fast, and fully deterministic: the same seed always produces
 * the same sequence, which is what lets bot behavior be replayed exactly.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Returns an integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer')
    }
    return Math.floor(this.next() * maxExclusive)
  }

  /** Returns an integer in [min, maxExclusive). */
  nextIntInRange(min: number, maxExclusive: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(maxExclusive) || maxExclusive <= min) {
      throw new Error('maxExclusive must be an integer greater than min')
    }
    return min + this.nextInt(maxExclusive - min)
  }

  /** Picks a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array')
    }
    return items[this.nextInt(items.length)] as T
  }
}
