import { describe, expect, it } from 'vitest'
import type { Bot, BotAction, BotContext } from './bots/types'
import { NoiseTrader } from './bots/noiseTrader'
import { BotRunner } from './botRunner'
import { LatencyModel } from './latency'
import { Rng } from './rng'
import { Simulation } from './simulation'
import type { Fill, OrderId } from './types'

function recordingBot(
  participantId: string,
  script: (context: BotContext, call: number) => readonly BotAction[],
): { bot: Bot; contexts: BotContext[] } {
  const contexts: BotContext[] = []
  const bot: Bot = {
    participantId,
    decide(context) {
      const call = contexts.length
      contexts.push(context)
      return script(context, call)
    },
  }
  return { bot, contexts }
}

describe('BotRunner — open order tracking', () => {
  it("tracks a bot's own resting order through a partial fill, a full fill, and a cancel", () => {
    const latency = new LatencyModel(new Rng(1)) // default profile: fixed, zero delay
    const sim = new Simulation(latency)

    let orderBId: OrderId | undefined
    const { bot, contexts } = recordingBot('bot', (context, call) => {
      if (call === 0) {
        return [{ kind: 'submit', order: { participantId: 'bot', side: 'buy', type: 'limit', price: 100, qty: 10 } }]
      }
      if (call === 4) {
        return [{ kind: 'submit', order: { participantId: 'bot', side: 'buy', type: 'limit', price: 100, qty: 5 } }]
      }
      if (call === 5) {
        orderBId = context.ownOpenOrderIds[0]
        return orderBId === undefined ? [] : [{ kind: 'cancel', orderId: orderBId }]
      }
      return []
    })

    const runner = new BotRunner(sim, [bot], 1)

    runner.runUntil(1) // call 0: submits order A
    runner.runUntil(2) // order A lands; call 1 sees it resting
    sim.submit({ participantId: 'counterparty', side: 'sell', type: 'limit', price: 100, qty: 4 })
    runner.runUntil(3) // partial fill lands; call 2 sees A still resting (6 left)
    sim.submit({ participantId: 'counterparty', side: 'sell', type: 'limit', price: 100, qty: 6 })
    runner.runUntil(4) // full fill lands; call 3 sees A is gone
    runner.runUntil(5) // call 4: submits order B
    runner.runUntil(6) // order B lands; call 5 sees it resting and cancels it
    runner.runUntil(7) // cancel confirmed; call 6 sees it's gone

    expect(contexts.map((c) => c.ownOpenOrderIds)).toEqual([
      [], // call 0 — before A exists
      [1], // call 1 — A resting
      [1], // call 2 — A still resting after a partial fill
      [], // call 3 — A fully filled, left the book
      [], // call 4 — before B exists
      [4], // call 5 — B resting (ids 2 and 3 went to the counterparty's two sells)
      [], // call 6 — B's cancel confirmed
    ])
  })
})

describe('BotRunner — public trade tape', () => {
  it('lets a bot see a fill it was not a party to', () => {
    const latency = new LatencyModel(new Rng(1))
    const sim = new Simulation(latency)

    const seenFills: Fill[][] = []
    const observer: Bot = {
      participantId: 'observer',
      decide(context) {
        seenFills.push([...context.recentFills])
        return []
      },
    }
    const runner = new BotRunner(sim, [observer], 1)

    sim.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 5 })
    runner.runUntil(1) // maker's order lands; nothing has traded yet
    sim.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 5 })
    runner.runUntil(2) // the trade happens between maker and taker — not the observer

    expect(seenFills[0]).toEqual([])
    expect(seenFills[1]).toHaveLength(1)
    expect(seenFills[1]?.[0]).toMatchObject({ makerParticipantId: 'maker', takerParticipantId: 'taker', qty: 5 })
  })
})

describe('BotRunner — determinism', () => {
  function runScenario(seed: number) {
    const latency = new LatencyModel(new Rng(seed))
    latency.setProfile('noise', { kind: 'jitter', min: 1, max: 5 })
    const sim = new Simulation(latency)
    const noiseTrader = new NoiseTrader(
      { participantId: 'noise', actionProbability: 0.8, minQty: 1, maxQty: 5, maxOffset: 3, fallbackPrice: 100 },
      new Rng(seed + 1),
    )
    const runner = new BotRunner(sim, [noiseTrader], 2)
    runner.runUntil(50)
    return sim.snapshot()
  }

  it('produces an identical final book for the same seed', () => {
    const snapshotA = runScenario(99)
    const snapshotB = runScenario(99)

    expect(snapshotB).toEqual(snapshotA)
  })
})

describe('BotRunner — validation', () => {
  it('rejects a non-positive or non-integer tick interval', () => {
    const sim = new Simulation(new LatencyModel(new Rng(1)))
    expect(() => new BotRunner(sim, [], 0)).toThrow()
    expect(() => new BotRunner(sim, [], -1)).toThrow()
    expect(() => new BotRunner(sim, [], 1.5)).toThrow()
  })
})
