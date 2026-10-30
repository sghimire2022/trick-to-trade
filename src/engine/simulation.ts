import type { LatencyModel } from './latency'
import { MatchingEngine } from './matchingEngine'
import { Scheduler } from './scheduler'
import type { BookSnapshot, EngineEvent, OrderId, SubmitOrderInput, Time } from './types'

export interface SimulationLogEntry {
  readonly time: Time
  /** Which participant this became known to. Absent for book-wide state (bookUpdate, orderCancelled). */
  readonly recipient?: string
  readonly event: EngineEvent
}

/**
 * The orchestrator: owns the Scheduler and the (pure, time-agnostic)
 * MatchingEngine, and is the only place latency is modeled. An order
 * reaches the matching engine only after the submitting participant's
 * outbound latency elapses; once matched, each side of a fill learns about
 * it only after its own return latency elapses. Both legs are plain
 * scheduled callbacks — there is no separate "latency system," just events
 * placed later on the same queue.
 *
 * The player is a participant like any other: nothing here special-cases
 * a particular participantId.
 */
export class Simulation {
  private readonly scheduler = new Scheduler()
  private readonly engine = new MatchingEngine()
  private readonly latency: LatencyModel
  private readonly log: SimulationLogEntry[] = []

  constructor(latency: LatencyModel) {
    this.latency = latency
  }

  now(): Time {
    return this.scheduler.now()
  }

  /** Advances simulated time, running every scheduled arrival/notification due by then. */
  step(until: Time): void {
    this.scheduler.runUntil(until)
  }

  /** Queues an order to reach the matching engine after the participant's outbound latency. */
  submit(input: SubmitOrderInput): void {
    const arrivalTime = this.scheduler.now() + this.latency.delayFor(input.participantId)
    this.scheduler.schedule(arrivalTime, () => {
      this.engine.submit(input)
      this.deliverEngineEvents(arrivalTime)
    })
  }

  /** Queues a cancel to reach the matching engine after the participant's outbound latency. */
  cancel(participantId: string, orderId: OrderId): void {
    const arrivalTime = this.scheduler.now() + this.latency.delayFor(participantId)
    this.scheduler.schedule(arrivalTime, () => {
      this.engine.cancel(orderId)
      this.deliverEngineEvents(arrivalTime)
    })
  }

  /** Ground-truth book state, independent of anyone's notification latency. */
  snapshot(): BookSnapshot {
    return this.engine.snapshot()
  }

  /** Ground-truth queue position: quantity resting ahead of `orderId`. Undefined if it isn't resting. */
  queueAheadOf(orderId: OrderId): number | undefined {
    return this.engine.queueAheadOf(orderId)
  }

  /** Drains and returns every log entry recorded since the last call. */
  drainLog(): SimulationLogEntry[] {
    return this.log.splice(0, this.log.length)
  }

  private deliverEngineEvents(arrivalTime: Time): void {
    for (const event of this.engine.drainEvents()) {
      if (event.type === 'fill') {
        // The trade itself is public market data the instant it happens —
        // anyone watching the tape sees it, whether or not they were a party
        // to it. Each side additionally gets its own private confirmation,
        // delayed by its own return latency.
        this.log.push({ time: arrivalTime, event })
        this.notify(arrivalTime, event.fill.makerParticipantId, event)
        this.notify(arrivalTime, event.fill.takerParticipantId, event)
      } else if (event.type === 'orderAccepted') {
        this.notify(arrivalTime, event.order.participantId, event)
      } else if (event.type === 'orderCancelled') {
        this.notify(arrivalTime, event.participantId, event)
      } else {
        // bookUpdate: book-wide state, not a private notification.
        this.log.push({ time: arrivalTime, event })
      }
    }
  }

  /** Schedules `event` to land in the log for `participantId` after their own return latency. */
  private notify(arrivalTime: Time, participantId: string, event: EngineEvent): void {
    const notifyTime = arrivalTime + this.latency.delayFor(participantId)
    this.scheduler.schedule(notifyTime, () => {
      this.log.push({ time: notifyTime, recipient: participantId, event })
    })
  }
}
