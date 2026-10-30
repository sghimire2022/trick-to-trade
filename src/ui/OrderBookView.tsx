import type { BookSnapshot, Price, Side } from '../engine/types'

interface OrderBookViewProps {
  readonly snapshot: BookSnapshot
  /** Center of the displayed price ladder — shown even when nothing is resting there yet. */
  readonly referencePrice: Price
  /** How many ticks above and below the reference price to show. */
  readonly tickRange: number
  readonly onPlaceOrder: (side: Side, price: Price) => void
}

const ROW_HEIGHT = 28
const GUTTER = 72
const MAX_BAR_WIDTH = 120
const WIDTH = 2 * GUTTER + 2 * MAX_BAR_WIDTH

export function OrderBookView({ snapshot, referencePrice, tickRange, onPlaceOrder }: OrderBookViewProps) {
  const prices: Price[] = []
  for (let price = referencePrice + tickRange; price >= referencePrice - tickRange; price--) {
    prices.push(price)
  }

  const bidByPrice = new Map(snapshot.bids.map((level) => [level.price, level]))
  const askByPrice = new Map(snapshot.asks.map((level) => [level.price, level]))
  const maxQty = Math.max(1, ...snapshot.bids.map((l) => l.totalQty), ...snapshot.asks.map((l) => l.totalQty))

  const centerX = WIDTH / 2
  const height = prices.length * ROW_HEIGHT

  return (
    <svg
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="Order book: click a row's left side to bid, right side to ask"
      className="max-w-full font-mono text-xs select-none"
    >
      {prices.map((price, i) => {
        const y = i * ROW_HEIGHT
        const bid = bidByPrice.get(price)
        const ask = askByPrice.get(price)
        const bidWidth = bid !== undefined ? (bid.totalQty / maxQty) * MAX_BAR_WIDTH : 0
        const askWidth = ask !== undefined ? (ask.totalQty / maxQty) * MAX_BAR_WIDTH : 0

        return (
          <g key={price}>
            <rect
              x={0}
              y={y}
              width={centerX}
              height={ROW_HEIGHT}
              className="fill-transparent hover:fill-emerald-500/10"
              style={{ cursor: 'pointer' }}
              onClick={() => onPlaceOrder('buy', price)}
            />
            <rect
              x={centerX}
              y={y}
              width={centerX}
              height={ROW_HEIGHT}
              className="fill-transparent hover:fill-rose-500/10"
              style={{ cursor: 'pointer' }}
              onClick={() => onPlaceOrder('sell', price)}
            />

            <rect
              x={centerX - GUTTER - bidWidth}
              y={y + 4}
              width={bidWidth}
              height={ROW_HEIGHT - 8}
              className="fill-emerald-500/70 pointer-events-none"
            />
            <rect
              x={centerX + GUTTER}
              y={y + 4}
              width={askWidth}
              height={ROW_HEIGHT - 8}
              className="fill-rose-500/70 pointer-events-none"
            />

            {bid !== undefined && (
              <text
                x={centerX - GUTTER - bidWidth - 6}
                y={y + ROW_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-emerald-400 pointer-events-none"
              >
                {bid.totalQty}
              </text>
            )}
            {ask !== undefined && (
              <text
                x={centerX + GUTTER + askWidth + 6}
                y={y + ROW_HEIGHT / 2}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-rose-400 pointer-events-none"
              >
                {ask.totalQty}
              </text>
            )}

            <text
              x={centerX}
              y={y + ROW_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-200 pointer-events-none"
            >
              {price}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
