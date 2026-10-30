import type { OrderId, SubmitOrderInput } from '../engine/types'
import type { WorkerInitMessage, WorkerRequest, WorkerUpdateMessage } from './messages'

export interface SimulationClient {
  submit(order: SubmitOrderInput): void
  cancel(orderId: OrderId): void
  /** Subscribes to periodic `{ time, snapshot, log }` updates. Returns an unsubscribe function. */
  onUpdate(callback: (update: WorkerUpdateMessage) => void): () => void
  /** Stops the worker's tick loop and terminates it. */
  dispose(): void
}

/** Spins up the simulation worker and returns a typed handle to it. */
export function createSimulationClient(init: Omit<WorkerInitMessage, 'type'>): SimulationClient {
  const worker = new Worker(new URL('./simulationWorker.ts', import.meta.url), { type: 'module' })
  const listeners = new Set<(update: WorkerUpdateMessage) => void>()

  worker.onmessage = (event: MessageEvent<WorkerUpdateMessage>) => {
    for (const listener of listeners) listener(event.data)
  }
  worker.onerror = (event) => {
    // An uncaught exception inside the worker (e.g. the tick loop) would
    // otherwise fail silently — surface it so it's at least visible.
    console.error('Simulation worker error:', event.message, event)
  }

  const send = (request: WorkerRequest): void => worker.postMessage(request)
  send({ type: 'init', ...init })

  return {
    submit(order) {
      send({ type: 'submit', order })
    },
    cancel(orderId) {
      send({ type: 'cancel', orderId })
    },
    onUpdate(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    dispose() {
      send({ type: 'stop' })
      worker.terminate()
    },
  }
}
