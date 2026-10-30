# TickToTrade

A free, browser-based game that teaches how high-frequency trading and market
microstructure actually work. You act as a market maker on a live limit order
book, competing against trading bots — each level teaches one concept through
play rather than text.

> **Educational simulation only.** No real money, no real brokerage, no real
> market connectivity. Nothing here is financial advice.

## Status

Levels 1–3 of the 5-level MVP are playable:

1. **The order book** — place a limit order and watch it rest in the book.
2. **Getting filled** — price-time priority and queue position.
3. **Market making** — quote both sides, earn the spread, watch PnL and
   inventory against bots running continuously in a Web Worker.

Levels 4 ("Adverse selection") and 5 ("The latency race") are next — see
[TODO.md](./TODO.md) for current progress and open questions, and
[CLAUDE.md](./CLAUDE.md) for the full project spec and architecture decisions.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL. A level switcher at the top lets you
jump between levels 1–3.

## Scripts

| Command            | What it does                                   |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload       |
| `npm run build`     | Type-check and build a production bundle        |
| `npm run preview`   | Preview the production build locally            |
| `npm test`          | Run the Vitest suite (engine + level logic)     |
| `npm run typecheck` | Type-check the whole project without emitting   |
| `npm run lint`      | Run Oxlint                                      |

## Tech stack

TypeScript (strict), React, Vite, Tailwind CSS, Vitest. The simulation engine
(`src/engine/`) is pure TypeScript with no DOM or React dependencies, and runs
continuously in a Web Worker (`src/worker/`) for levels with bot activity.

## Project structure

```
src/
  engine/   Pure, deterministic simulation — order book, matching engine,
            scheduler, latency model, bot strategies. No DOM, no React.
  levels/   Level definitions: config, goals, bot rosters, PnL/scoring.
  ui/       React components (OrderBookView, level pages, shared hooks).
  worker/   Web Worker wrapper that drives bots against a running
            Simulation without blocking the UI thread.
```

See CLAUDE.md's Architecture section for the full breakdown, including the
"Time and event scheduling" decision record for how simulated time and
latency are modeled.
