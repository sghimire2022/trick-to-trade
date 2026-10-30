import { describe, expect, it } from 'vitest'
import { Scheduler } from './scheduler'

describe('Scheduler', () => {
  it('starts at time 0', () => {
    const scheduler = new Scheduler()
    expect(scheduler.now()).toBe(0)
  })

  it('runs events in time order', () => {
    const scheduler = new Scheduler()
    const order: number[] = []
    scheduler.schedule(5, () => order.push(5))
    scheduler.schedule(1, () => order.push(1))
    scheduler.schedule(3, () => order.push(3))

    scheduler.runUntil(10)

    expect(order).toEqual([1, 3, 5])
  })

  it('runs same-time events in the order they were scheduled', () => {
    const scheduler = new Scheduler()
    const order: string[] = []
    scheduler.schedule(5, () => order.push('first'))
    scheduler.schedule(5, () => order.push('second'))
    scheduler.schedule(5, () => order.push('third'))

    scheduler.runUntil(5)

    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('processes events scheduled during the run if they are due by the target time', () => {
    const scheduler = new Scheduler()
    const order: string[] = []
    scheduler.schedule(1, () => {
      order.push('a')
      scheduler.schedule(2, () => order.push('b'))
    })

    scheduler.runUntil(10)

    expect(order).toEqual(['a', 'b'])
  })

  it('does not run events scheduled beyond the target time', () => {
    const scheduler = new Scheduler()
    const order: string[] = []
    scheduler.schedule(1, () => {
      order.push('a')
      scheduler.schedule(20, () => order.push('too-late'))
    })

    scheduler.runUntil(10)

    expect(order).toEqual(['a'])
    expect(scheduler.now()).toBe(10)
  })

  it('advances now() to the target time even with no events due', () => {
    const scheduler = new Scheduler()
    scheduler.runUntil(50)
    expect(scheduler.now()).toBe(50)
  })

  it('leaves now() at the time of the last processed event plus any remaining advance to target', () => {
    const scheduler = new Scheduler()
    scheduler.schedule(3, () => undefined)
    scheduler.runUntil(3)
    expect(scheduler.now()).toBe(3)
  })

  it('throws when scheduling an event in the past', () => {
    const scheduler = new Scheduler()
    scheduler.runUntil(10)
    expect(() => scheduler.schedule(5, () => undefined)).toThrow(/past/)
  })

  it('allows scheduling exactly at the current time', () => {
    const scheduler = new Scheduler()
    scheduler.runUntil(10)
    expect(() => scheduler.schedule(10, () => undefined)).not.toThrow()
  })

  it('throws when running backwards', () => {
    const scheduler = new Scheduler()
    scheduler.runUntil(10)
    expect(() => scheduler.runUntil(5)).toThrow(/backwards/)
  })

  it('rejects non-integer times', () => {
    const scheduler = new Scheduler()
    expect(() => scheduler.schedule(1.5, () => undefined)).toThrow()
    expect(() => scheduler.runUntil(1.5)).toThrow()
  })
})
