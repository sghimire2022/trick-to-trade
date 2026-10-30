import { describe, expect, it } from 'vitest'
import { LatencyModel } from './latency'
import { Rng } from './rng'
import { Simulation, type SimulationLogEntry } from './simulation'

describe('Simulation — latency', () => {
  it('lets a lower-latency participant reach the book first, even though it submitted after a slower one', () => {
    const latency = new LatencyModel(new Rng(1))
    latency.setProfile('maker', { kind: 'fixed', delay: 0 })
    latency.setProfile('slow', { kind: 'fixed', delay: 100 })
    latency.setProfile('fast', { kind: 'fixed', delay: 1 })
    const sim = new Simulation(latency)

    sim.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 10 })
    sim.step(0) // land the resting maker order at time 0

    // slow calls submit() first...
    sim.submit({ participantId: 'slow', side: 'buy', type: 'limit', price: 100, qty: 5 })
    // ...fast calls submit() second, but its order reaches the exchange sooner.
    sim.submit({ participantId: 'fast', side: 'buy', type: 'limit', price: 100, qty: 5 })

    sim.step(1)
    expect(sim.snapshot()).toEqual({ bids: [], asks: [{ price: 100, totalQty: 5, orderCount: 1 }] })

    sim.step(100)
    expect(sim.snapshot()).toEqual({ bids: [], asks: [] })
  })

  it('delivers a fill to each side only after that side\'s own return latency', () => {
    const latency = new LatencyModel(new Rng(1))
    latency.setProfile('maker', { kind: 'fixed', delay: 0 })
    latency.setProfile('taker', { kind: 'fixed', delay: 10 })
    const sim = new Simulation(latency)

    sim.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 5 })
    sim.step(0)
    sim.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 5 })

    // The taker's order lands at time 10; the fill itself happens then and
    // hits the public tape immediately (recipient undefined), plus the maker
    // (0 latency) is privately notified right away too. The taker's own
    // private notification doesn't land until its own 10 ticks of return
    // latency pass on top of that.
    sim.step(10)
    const earlyLog = sim.drainLog()
    const fillsSoFar = earlyLog.filter((entry) => entry.event.type === 'fill')
    expect(fillsSoFar.map((entry) => entry.recipient)).toEqual([undefined, 'maker'])

    sim.step(20)
    const laterLog = sim.drainLog()
    const laterFills = laterLog.filter((entry) => entry.event.type === 'fill')
    expect(laterFills.map((entry) => entry.recipient)).toEqual(['taker'])
  })

  it('delivers an order\'s own cancellation only to the participant who owned it', () => {
    const latency = new LatencyModel(new Rng(1))
    latency.setProfile('owner', { kind: 'fixed', delay: 5 })
    const sim = new Simulation(latency)

    sim.submit({ participantId: 'owner', side: 'buy', type: 'limit', price: 100, qty: 5 })
    sim.step(5) // order lands at time 5, id 1

    sim.cancel('owner', 1)
    sim.step(20)

    const cancelEntries = sim.drainLog().filter((entry) => entry.event.type === 'orderCancelled')
    expect(cancelEntries).toEqual([
      { time: 15, recipient: 'owner', event: { type: 'orderCancelled', orderId: 1, participantId: 'owner' } },
    ])
  })
})

describe('Simulation — determinism', () => {
  function runScenario(seed: number): SimulationLogEntry[] {
    const latency = new LatencyModel(new Rng(seed))
    latency.setProfile('maker', { kind: 'fixed', delay: 0 })
    latency.setProfile('taker', { kind: 'jitter', min: 1, max: 5 })
    const sim = new Simulation(latency)

    sim.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 10 })
    sim.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 4 })
    sim.step(10)
    sim.cancel('maker', 1)
    sim.step(20)
    return sim.drainLog()
  }

  it('produces an identical log for the same seed and the same inputs', () => {
    const logA = runScenario(7)
    const logB = runScenario(7)

    expect(logB).toEqual(logA)
  })
})
