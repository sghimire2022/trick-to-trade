import { describe, expect, it } from 'vitest'
import { Rng } from './rng'

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42)
    const b = new Rng(42)

    const sequenceA = Array.from({ length: 10 }, () => a.next())
    const sequenceB = Array.from({ length: 10 }, () => b.next())

    expect(sequenceB).toEqual(sequenceA)
  })

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1)
    const b = new Rng(2)

    expect(a.next()).not.toBe(b.next())
  })

  it('next() stays within [0, 1)', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 1000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('nextInt() stays within [0, maxExclusive) and is deterministic per seed', () => {
    const a = new Rng(123)
    const b = new Rng(123)
    for (let i = 0; i < 500; i++) {
      const x = a.nextInt(10)
      const y = b.nextInt(10)
      expect(x).toBe(y)
      expect(Number.isInteger(x)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(10)
    }
  })

  it('nextInt() rejects a non-positive or non-integer bound', () => {
    const rng = new Rng(1)
    expect(() => rng.nextInt(0)).toThrow()
    expect(() => rng.nextInt(-1)).toThrow()
    expect(() => rng.nextInt(1.5)).toThrow()
  })

  it('nextIntInRange() stays within [min, maxExclusive)', () => {
    const rng = new Rng(99)
    for (let i = 0; i < 500; i++) {
      const value = rng.nextIntInRange(5, 15)
      expect(value).toBeGreaterThanOrEqual(5)
      expect(value).toBeLessThan(15)
    }
  })

  it('nextIntInRange() rejects an invalid range', () => {
    const rng = new Rng(1)
    expect(() => rng.nextIntInRange(10, 10)).toThrow()
    expect(() => rng.nextIntInRange(10, 5)).toThrow()
    expect(() => rng.nextIntInRange(1.5, 10)).toThrow()
  })

  it('pick() returns one of the given elements, deterministically per seed', () => {
    const items = ['a', 'b', 'c', 'd'] as const
    const a = new Rng(5)
    const b = new Rng(5)

    for (let i = 0; i < 50; i++) {
      const x = a.pick(items)
      const y = b.pick(items)
      expect(items).toContain(x)
      expect(x).toBe(y)
    }
  })

  it('pick() rejects an empty array', () => {
    const rng = new Rng(1)
    expect(() => rng.pick([])).toThrow()
  })
})
