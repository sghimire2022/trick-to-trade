import { useCallback, useState } from 'react'
import { LatencyModel } from '../engine/latency'
import { Rng } from '../engine/rng'
import { Simulation } from '../engine/simulation'
import type { BookSnapshot, Price, Side } from '../engine/types'
import { level1 } from '../levels/level1'
import { useFeed } from './feed'
import { OrderBookView } from './OrderBookView'

const REFERENCE_PRICE = 100
const TICK_RANGE = 8
const QTY_OPTIONS = [1, 5, 10] as const

export function Level1Page() {
  const [simulation] = useState(() => new Simulation(new LatencyModel(new Rng(1))))
  const [snapshot, setSnapshot] = useState<BookSnapshot>(() => simulation.snapshot())
  const [qty, setQty] = useState<number>(5)
  const { feed, absorb } = useFeed(level1.playerParticipantId)

  const placeOrder = useCallback(
    (side: Side, price: Price) => {
      simulation.submit({ participantId: level1.playerParticipantId, side, type: 'limit', price, qty })
      // The player has zero latency in Level 1 — latency isn't the lesson
      // yet — so stepping to the current time flushes the order immediately.
      simulation.step(simulation.now())

      setSnapshot(simulation.snapshot())
      absorb(simulation.drainLog())
    },
    [simulation, qty, absorb],
  )

  const bestBid = snapshot.bids[0]?.price
  const bestAsk = snapshot.asks[0]?.price
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold">{level1.title}</h1>
        <p className="mt-1 text-slate-400">{level1.goal}</p>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800/50 px-4 py-3 font-mono text-sm">
        <span>
          Best bid: <span className="text-emerald-400">{bestBid ?? '—'}</span>
        </span>
        <span>
          Best ask: <span className="text-rose-400">{bestAsk ?? '—'}</span>
        </span>
        <span>Spread: {spread ?? '—'}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Order size:</span>
        {QTY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setQty(option)}
            className={
              option === qty
                ? 'rounded bg-slate-100 px-3 py-1 font-mono text-slate-900'
                : 'rounded bg-slate-800 px-3 py-1 font-mono text-slate-300 hover:bg-slate-700'
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex justify-center overflow-x-auto">
        <OrderBookView
          snapshot={snapshot}
          referencePrice={REFERENCE_PRICE}
          tickRange={TICK_RANGE}
          onPlaceOrder={placeOrder}
        />
      </div>
      <p className="text-center text-xs text-slate-500">Click the left side of a row to bid, the right side to ask.</p>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">What just happened</h2>
        <ul className="flex flex-col gap-1 font-mono text-xs text-slate-400">
          {feed.length === 0 && <li className="text-slate-600">Nothing yet — place an order above.</li>}
          {feed.map((item) => (
            <li key={item.id}>{item.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
