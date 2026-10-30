import type { SimulationRosterConfig } from '../levels/types'
import type { SimulationLogEntry } from '../engine/simulation'
import type { BookSnapshot, OrderId, SubmitOrderInput, Time } from '../engine/types'

export interface WorkerInitMessage extends SimulationRosterConfig {
  readonly type: 'init'
  readonly playerParticipantId: string
}

export type WorkerRequest =
  | WorkerInitMessage
  | { readonly type: 'submit'; readonly order: SubmitOrderInput }
  | { readonly type: 'cancel'; readonly orderId: OrderId }
  | { readonly type: 'stop' }

export interface WorkerUpdateMessage {
  readonly type: 'update'
  readonly time: Time
  readonly snapshot: BookSnapshot
  readonly log: readonly SimulationLogEntry[]
}

export type WorkerResponse = WorkerUpdateMessage
