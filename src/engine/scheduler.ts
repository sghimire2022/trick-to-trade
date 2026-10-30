import type { Time } from './types'

type SchedulerCallback = () => void

interface HeapEntry {
  readonly time: Time
  readonly sequence: number
  readonly callback: SchedulerCallback
}

/**
 * Owns simulated time and the event queue. Nothing else in the engine
 * tracks time — the matching engine is pure, and latency is modeled purely
 * by scheduling a callback for later.
 *
 * Events are ordered by time, then by insertion order (a sequence number)
 * so two events scheduled for the same time always run in the order they
 * were scheduled, never by heap-internal tie-breaking.
 */
export class Scheduler {
  private readonly heap: HeapEntry[] = []
  private nextSequence = 0
  private currentTime: Time = 0

  now(): Time {
    return this.currentTime
  }

  /** Queues `callback` to run at `time`. `time` cannot be before the current time. */
  schedule(time: Time, callback: SchedulerCallback): void {
    if (!Number.isInteger(time)) {
      throw new Error('Scheduled time must be an integer')
    }
    if (time < this.currentTime) {
      throw new Error(`Cannot schedule an event in the past: ${time} < ${this.currentTime}`)
    }
    this.heapPush({ time, sequence: this.nextSequence++, callback })
  }

  /**
   * Runs every event due at or before `until`, in (time, insertion order).
   * A callback may schedule further events; if those are due by `until`
   * they run within this same call. Afterwards, `now()` equals `until`.
   */
  runUntil(until: Time): void {
    if (!Number.isInteger(until)) {
      throw new Error('Target time must be an integer')
    }
    if (until < this.currentTime) {
      throw new Error(`Cannot run backwards: ${until} < ${this.currentTime}`)
    }

    while (this.heap.length > 0 && (this.heap[0] as HeapEntry).time <= until) {
      const entry = this.heapPop() as HeapEntry
      this.currentTime = entry.time
      entry.callback()
    }
    this.currentTime = until
  }

  private compare(a: HeapEntry, b: HeapEntry): number {
    return a.time !== b.time ? a.time - b.time : a.sequence - b.sequence
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i] as HeapEntry
    this.heap[i] = this.heap[j] as HeapEntry
    this.heap[j] = temp
  }

  private heapPush(entry: HeapEntry): void {
    this.heap.push(entry)
    let i = this.heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.compare(this.heap[i] as HeapEntry, this.heap[parent] as HeapEntry) >= 0) break
      this.swap(i, parent)
      i = parent
    }
  }

  private heapPop(): HeapEntry | undefined {
    const top = this.heap[0]
    const last = this.heap.pop()
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last
      this.siftDown(0)
    }
    return top
  }

  private siftDown(i: number): void {
    const n = this.heap.length
    let current = i
    for (;;) {
      const left = 2 * current + 1
      const right = 2 * current + 2
      let smallest = current
      if (left < n && this.compare(this.heap[left] as HeapEntry, this.heap[smallest] as HeapEntry) < 0) smallest = left
      if (right < n && this.compare(this.heap[right] as HeapEntry, this.heap[smallest] as HeapEntry) < 0) smallest = right
      if (smallest === current) break
      this.swap(current, smallest)
      current = smallest
    }
  }
}
