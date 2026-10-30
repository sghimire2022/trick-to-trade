import { useCallback, useState } from 'react'
import { LatencyModel } from '../engine/latency'
import { Rng } from '../engine/rng'
import { Simulation } from '../engine/simulation'
import type { BookSnapshot, OrderId, Price, Side } from '../engine/types'
import { level2 } from '../levels/level2'
import { useFeed } from './feed'
import { OrderBookView } from './OrderBookView'

const REFERENCE_PRICE = 100
const TICK_RANGE = 8
const HOUSE_PRICE = 100
const HOUSE_QTY = 10
const PLAYER_QTY = 5
const TAKER_QTY = 5

function createSeededSimulation() {
  const sim = new Simulation(new LatencyModel(new Rng(1)))
  sim.submit({ participantId: 'house', side: 'sell', type: 'limit', price: HOUSE_PRICE, qty: HOUSE_QTY })
  sim.step(sim.now())
  sim.drainLog() // house's own notifications aren't the player's concern
  return sim
}

export function Level2Page() {
  const [simulation] = useState(createSeededSimulation)
  const [snapshot, setSnapshot] = useState<BookSnapshot>(() => simulation.snapshot())
  const [myOrderId, setMyOrderId] = useState<OrderId | undefined>(undefined)
  const { feed, absorb } = useFeed(level2.playerParticipantId)

  const sync = useCallback(() => {
    simulation.step(simulation.now())
    setSnapshot(simulation.snapshot())
    const entries = simulation.drainLog()
    absorb(entries)

    setMyOrderId((current) => {
      let next = current
      for (const entry of entries) {
        if (entry.recipient === level2.playerParticipantId && entry.event.type === 'orderAccepted') {
          next = entry.event.order.id
        }
      }
      // If the order we're tracking is no longer resting, it was fully
      // filled — clear it so the player can join the queue again.
      return next !== undefined && simulation.queueAheadOf(next) === undefined ? undefined : next
    })
  }, [simulation, absorb])

  const placeOrder = useCallback(
    (side: Side, price: Price) => {
      if (myOrderId !== undefined) return // one order at a time, to keep "your position" unambiguous
      simulation.submit({ participantId: level2.playerParticipantId, side, type: 'limit', price, qty: PLAYER_QTY })
      sync()
    },
    [simulation, myOrderId, sync],
  )

  const sendBuyer = useCallback(() => {
    simulation.submit({ participantId: 'taker', side: 'buy', type: 'market', qty: TAKER_QTY })
    sync()
  }, [simulation, sync])

  const queueAhead = myOrderId !== undefined ? simulation.queueAheadOf(myOrderId) : undefined

  const bestBid = snapshot.bids[0]?.price
  const bestAsk = snapshot.asks[0]?.price

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold">{level2.title}</h1>
        <p className="mt-1 text-slate-400">{level2.goal}</p>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800/50 px-4 py-3 font-mono text-sm">
        <span>
          Best bid: <span className="text-emerald-400">{bestBid ?? '—'}</span>
        </span>
        <span>
          Best ask: <span className="text-rose-400">{bestAsk ?? '—'}</span>
        </span>
        {myOrderId === undefined ? (
          <span className="text-slate-500">Click ask @ {HOUSE_PRICE} to join the queue behind "house."</span>
        ) : (
          <span>
            Shares ahead of you: <span className="text-amber-400">{queueAhead}</span>
          </span>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={sendBuyer}
          className="rounded bg-slate-800 px-3 py-1.5 font-mono text-sm text-slate-200 hover:bg-slate-700"
        >
          Send a buyer (takes {TAKER_QTY} shares)
        </button>
      </div>

      <div className="flex justify-center overflow-x-auto">
        <OrderBookView
          snapshot={snapshot}
          referencePrice={REFERENCE_PRICE}
          tickRange={TICK_RANGE}
          onPlaceOrder={placeOrder}
        />
      </div>
      <p className="text-center text-xs text-slate-500">
        "House" is already resting {HOUSE_QTY} shares at the ask. Join behind it, then send buyers and watch who
        fills first.
      </p>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">What just happened</h2>
        <ul className="flex flex-col gap-1 font-mono text-xs text-slate-400">
          {feed.length === 0 && <li className="text-slate-600">Nothing yet — join the queue above.</li>}
          {feed.map((item) => (
            <li key={item.id}>{item.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
