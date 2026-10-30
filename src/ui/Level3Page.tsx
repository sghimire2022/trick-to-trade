import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookSnapshot, OrderId, Price, Side } from '../engine/types'
import { level3 } from '../levels/level3'
import { INITIAL_PNL_STATE, PnlTracker, type PnlState } from '../levels/pnlTracker'
import { createSimulationClient, type SimulationClient } from '../worker/workerClient'
import { useFeed } from './feed'
import { OrderBookView } from './OrderBookView'

const REFERENCE_PRICE = 100
const TICK_RANGE = 8
const PLAYER_QTY = 5

interface MyQuote {
  readonly orderId: OrderId
  readonly side: Side
  readonly price: Price
  readonly remainingQty: number
}

export function Level3Page() {
  const [snapshot, setSnapshot] = useState<BookSnapshot>({ bids: [], asks: [] })
  const [pnlState, setPnlState] = useState<PnlState>(INITIAL_PNL_STATE)
  const [myQuotes, setMyQuotes] = useState<MyQuote[]>([])
  const [secondsRemaining, setSecondsRemaining] = useState(level3.roundDurationSeconds)
  const { feed, absorb } = useFeed(level3.playerParticipantId)

  const clientRef = useRef<SimulationClient | null>(null)
  const [pnlTracker] = useState(() => new PnlTracker(level3.playerParticipantId))

  useEffect(() => {
    const client = createSimulationClient({ ...level3.simulation, playerParticipantId: level3.playerParticipantId })
    clientRef.current = client

    const unsubscribe = client.onUpdate((update) => {
      setSnapshot(update.snapshot)
      absorb(update.log)
      pnlTracker.absorb(update.log)
      setPnlState(pnlTracker.state)

      setMyQuotes((prev) => {
        const byId = new Map(prev.map((quote) => [quote.orderId, quote]))
        for (const entry of update.log) {
          if (entry.recipient !== level3.playerParticipantId) continue

          if (entry.event.type === 'orderAccepted') {
            const order = entry.event.order
            if (order.type === 'limit' && order.remainingQty > 0) {
              byId.set(order.id, { orderId: order.id, side: order.side, price: order.price, remainingQty: order.remainingQty })
            }
          } else if (entry.event.type === 'fill' && entry.event.fill.makerParticipantId === level3.playerParticipantId) {
            const { makerOrderId, makerRemainingQty } = entry.event.fill
            if (makerRemainingQty === 0) {
              byId.delete(makerOrderId)
            } else {
              const existing = byId.get(makerOrderId)
              if (existing !== undefined) byId.set(makerOrderId, { ...existing, remainingQty: makerRemainingQty })
            }
          } else if (entry.event.type === 'orderCancelled') {
            byId.delete(entry.event.orderId)
          }
        }
        return Array.from(byId.values())
      })
    })

    return () => {
      unsubscribe()
      client.dispose()
      clientRef.current = null
    }
  }, [absorb, pnlTracker])

  // The round clock is plain wall-clock UI timing — fine here; the engine
  // and the worker's own tick loop never use it.
  useEffect(() => {
    const id = setInterval(() => setSecondsRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const roundOver = secondsRemaining <= 0

  const placeOrder = useCallback(
    (side: Side, price: Price) => {
      if (roundOver) return
      clientRef.current?.submit({ participantId: level3.playerParticipantId, side, type: 'limit', price, qty: PLAYER_QTY })
    },
    [roundOver],
  )

  const cancelOrder = useCallback((orderId: OrderId) => {
    clientRef.current?.cancel(orderId)
  }, [])

  const bestBid = snapshot.bids[0]?.price
  const bestAsk = snapshot.asks[0]?.price
  const midPrice = bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : REFERENCE_PRICE
  const pnl = pnlTracker.markToMarket(midPrice)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 text-slate-100">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{level3.title}</h1>
          <p className="mt-1 text-slate-400">{level3.goal}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-800/50 px-3 py-2 text-right font-mono text-sm">
          <div className="text-slate-400">Time left</div>
          <div className={roundOver ? 'text-rose-400' : 'text-slate-100'}>{secondsRemaining}s</div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800/50 px-4 py-3 font-mono text-sm">
        <span>
          Best bid: <span className="text-emerald-400">{bestBid ?? '—'}</span>
        </span>
        <span>
          Best ask: <span className="text-rose-400">{bestAsk ?? '—'}</span>
        </span>
        <span>
          Inventory: <span className={pnlState.inventory >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pnlState.inventory}</span>
        </span>
        <span>
          PnL: <span className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pnl.toFixed(0)}</span>
        </span>
      </div>

      {roundOver && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-center">
          Round over — final PnL: <span className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pnl.toFixed(0)}</span>
        </div>
      )}

      <div className="flex justify-center overflow-x-auto">
        <OrderBookView
          snapshot={snapshot}
          referencePrice={REFERENCE_PRICE}
          tickRange={TICK_RANGE}
          onPlaceOrder={placeOrder}
        />
      </div>
      <p className="text-center text-xs text-slate-500">
        Click a row to quote that side. Noise traders arrive on their own — you don't need to trigger them.
      </p>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Your quotes</h2>
        {myQuotes.length === 0 ? (
          <p className="font-mono text-xs text-slate-600">No resting orders — click the book above to quote.</p>
        ) : (
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {myQuotes.map((quote) => (
              <li key={quote.orderId} className="flex items-center gap-2">
                <span className={quote.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>
                  {quote.side === 'buy' ? 'BID' : 'ASK'} {quote.remainingQty} @ {quote.price}
                </span>
                <button
                  type="button"
                  onClick={() => cancelOrder(quote.orderId)}
                  className="rounded bg-slate-800 px-2 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                >
                  cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">What just happened</h2>
        <ul className="flex flex-col gap-1 font-mono text-xs text-slate-400">
          {feed.length === 0 && <li className="text-slate-600">Nothing yet.</li>}
          {feed.map((item) => (
            <li key={item.id}>{item.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
