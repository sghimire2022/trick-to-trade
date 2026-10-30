import type { Bot, BotContext } from './bots/types'
import type { Simulation, SimulationLogEntry } from './simulation'
import type { Fill, OrderId, Time } from './types'

/**
 * Drives a fixed set of bots against a Simulation: advances time in fixed
 * ticks, and between ticks gives every bot a turn to decide() based on
 * what's landed in the log since the last tick. The Simulation has no idea
 * bots exist — this only uses its ordinary public submit/cancel/step/
 * drainLog surface, the same way a player's UI would.
 */
export class BotRunner {
  private readonly simulation: Simulation
  private readonly bots: readonly Bot[]
  private readonly tickInterval: Time
  private readonly ownOpenOrderIds = new Map<string, Set<OrderId>>()
  private readonly pendingFills: Fill[] = []

  constructor(simulation: Simulation, bots: readonly Bot[], tickInterval: Time) {
    if (!Number.isInteger(tickInterval) || tickInterval <= 0) {
      throw new Error('tickInterval must be a positive integer')
    }
    this.simulation = simulation
    this.bots = bots
    this.tickInterval = tickInterval
    for (const bot of bots) {
      this.ownOpenOrderIds.set(bot.participantId, new Set())
    }
  }

  /** Advances the simulation to `until`, giving every bot a turn once per tick along the way. */
  runUntil(until: Time): void {
    while (this.simulation.now() < until) {
      const next = Math.min(this.simulation.now() + this.tickInterval, until)
      this.simulation.step(next)
      this.absorbLog(this.simulation.drainLog())
      this.runBots()
    }
  }

  private absorbLog(entries: readonly SimulationLogEntry[]): void {
    for (const entry of entries) {
      if (entry.event.type === 'fill' && entry.recipient === undefined) {
        // The public tape: every bot sees every trade, not just its own.
        this.pendingFills.push(entry.event.fill)
      }

      if (entry.recipient === undefined) continue
      const openIds = this.ownOpenOrderIds.get(entry.recipient)
      if (openIds === undefined) continue // not a bot we're driving (e.g. the player)

      if (entry.event.type === 'orderAccepted') {
        const order = entry.event.order
        // Mirrors MatchingEngine's own resting rule: only a limit order with
        // quantity left over actually ends up in the book.
        if (order.type === 'limit' && order.remainingQty > 0) {
          openIds.add(order.id)
        }
      } else if (entry.event.type === 'fill' && entry.event.fill.makerParticipantId === entry.recipient) {
        if (entry.event.fill.makerRemainingQty === 0) {
          openIds.delete(entry.event.fill.makerOrderId)
        }
      } else if (entry.event.type === 'orderCancelled') {
        openIds.delete(entry.event.orderId)
      }
    }
  }

  private runBots(): void {
    const time = this.simulation.now()
    const snapshot = this.simulation.snapshot()
    const recentFills = this.pendingFills.splice(0, this.pendingFills.length)

    for (const bot of this.bots) {
      const context: BotContext = {
        time,
        snapshot,
        recentFills,
        ownOpenOrderIds: Array.from(this.ownOpenOrderIds.get(bot.participantId) ?? []),
      }

      for (const action of bot.decide(context)) {
        if (action.kind === 'submit') {
          this.simulation.submit(action.order)
        } else {
          this.simulation.cancel(bot.participantId, action.orderId)
        }
      }
    }
  }
}
