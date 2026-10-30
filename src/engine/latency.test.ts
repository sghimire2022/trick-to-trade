import { describe, expect, it } from 'vitest'
import { LatencyModel } from './latency'
import { Rng } from './rng'

describe('LatencyModel', () => {
  it('returns the default profile (zero delay) for an unconfigured participant', () => {
    const model = new LatencyModel(new Rng(1))
    expect(model.delayFor('nobody')).toBe(0)
  })

  it('honors a custom default profile', () => {
    const model = new LatencyModel(new Rng(1), { kind: 'fixed', delay: 5 })
    expect(model.delayFor('nobody')).toBe(5)
  })

  it('returns a constant delay for a fixed profile', () => {
    const model = new LatencyModel(new Rng(1))
    model.setProfile('slow-bot', { kind: 'fixed', delay: 20 })

    expect(model.delayFor('slow-bot')).toBe(20)
    expect(model.delayFor('slow-bot')).toBe(20)
    expect(model.delayFor('slow-bot')).toBe(20)
  })

  it('samples a jittered delay within [min, max]', () => {
    const model = new LatencyModel(new Rng(42))
    model.setProfile('bot', { kind: 'jitter', min: 3, max: 7 })

    for (let i = 0; i < 200; i++) {
      const delay = model.delayFor('bot')
      expect(Number.isInteger(delay)).toBe(true)
      expect(delay).toBeGreaterThanOrEqual(3)
      expect(delay).toBeLessThanOrEqual(7)
    }
  })

  it('produces the same jittered sequence for the same seed', () => {
    const modelA = new LatencyModel(new Rng(7))
    const modelB = new LatencyModel(new Rng(7))
    modelA.setProfile('bot', { kind: 'jitter', min: 1, max: 10 })
    modelB.setProfile('bot', { kind: 'jitter', min: 1, max: 10 })

    const sequenceA = Array.from({ length: 20 }, () => modelA.delayFor('bot'))
    const sequenceB = Array.from({ length: 20 }, () => modelB.delayFor('bot'))

    expect(sequenceB).toEqual(sequenceA)
  })

  it('gives different participants independent profiles', () => {
    const model = new LatencyModel(new Rng(1))
    model.setProfile('fast', { kind: 'fixed', delay: 1 })
    model.setProfile('slow', { kind: 'fixed', delay: 50 })

    expect(model.delayFor('fast')).toBe(1)
    expect(model.delayFor('slow')).toBe(50)
  })

  it('rejects an invalid fixed profile', () => {
    const model = new LatencyModel(new Rng(1))
    expect(() => model.setProfile('a', { kind: 'fixed', delay: -1 })).toThrow()
    expect(() => model.setProfile('a', { kind: 'fixed', delay: 1.5 })).toThrow()
  })

  it('rejects an invalid jitter profile', () => {
    const model = new LatencyModel(new Rng(1))
    expect(() => model.setProfile('a', { kind: 'jitter', min: 10, max: 5 })).toThrow()
    expect(() => model.setProfile('a', { kind: 'jitter', min: -1, max: 5 })).toThrow()
    expect(() => model.setProfile('a', { kind: 'jitter', min: 1.5, max: 5 })).toThrow()
  })

  it('rejects an invalid default profile at construction', () => {
    expect(() => new LatencyModel(new Rng(1), { kind: 'fixed', delay: -1 })).toThrow()
  })
})
