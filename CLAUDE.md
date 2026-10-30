# Project: [TickToTrade — working name]

## Vision
A free, browser-based game that teaches how high-frequency trading and market
microstructure actually work. Players learn by doing: they act as a market maker
on a live, animated limit order book, competing against trading bots. Each level
teaches one concept through play rather than text.

Goal: reach a large audience (students, aspiring quants, curious retail traders,
engineers interested in low latency). It must load instantly in a browser, work
on mobile, and produce shareable results. Long term: sponsored bot-vs-bot
competitions that trading firms can use for recruiting.

## Target audience
- Primary: university students and early-career people aiming for quant trading
  or low-latency engineering roles.
- Secondary: retail traders and tech-curious people who want to know "how HFT works."
- Assume NO finance background. Every concept must be explained visually and
  learnable in under 2 minutes.

## MVP scope (build this first, nothing more)
One web app with 5 levels:
1. **The order book** — what bids, asks, and the spread are; place a limit order
   and watch it rest in the book.
2. **Getting filled** — price-time priority and queue position; see why being
   first in line matters.
3. **Market making** — quote both sides, earn the spread, watch PnL and inventory.
4. **Adverse selection** — an informed bot picks you off when the price moves;
   learn to widen spreads and manage inventory.
5. **The latency race** — a faster bot beats you to stale quotes; latency becomes
   visible and tangible.

Each level has: a 1–2 sentence goal, a short interactive intro, the gameplay
round (60–120 seconds), a results screen explaining what happened, and a
shareable score card.

## Non-goals (for now)
- No real money, real brokerage, or real market connectivity. Ever, in the MVP.
- No user accounts or backend in v1 (local storage for progress is fine).
- No C++/Rust/WASM engine yet; TypeScript first, optimize later if needed.
- No use of real trading firms' names, logos, or claims about their internals.

## Tech stack
- TypeScript (strict mode), React, Vite
- Rendering: SVG or Canvas for the order book and charts; animations must stay
  smooth at 60fps on a mid-range phone
- Styling: Tailwind CSS
- State: Zustand (or React state if simple enough)
- Simulation engine: pure TypeScript, no React dependencies, runs in a Web Worker
- Testing: Vitest for engine logic; Playwright for a few end-to-end smoke tests
- Deployment: static site (Vercel / Netlify / GitHub Pages)

## Architecture
/src
  /engine        Pure simulation: no DOM, no React. Fully deterministic.
    orderBook.ts       Limit order book with price-time priority
    matchingEngine.ts  Matches orders, emits fills and book updates — pure, time-agnostic
    scheduler.ts       Owns simulated time and the event queue (binary heap)
    simulation.ts       Orchestrator: wires Scheduler + MatchingEngine + latency together
    botRunner.ts       Drives a set of bots against a Simulation in fixed ticks
    bots/              Bot strategies (noise trader, momentum, informed, fast MM)
    latency.ts         Per-participant delay profiles, sampled by the Simulation when scheduling
    rng.ts             Seeded random number generator
  /levels        Level definitions: config, goals, bot mix, scoring, copy text
  /ui            React components (OrderBookView, PnLChart, Controls, ScoreCard)
  /worker        Web Worker wrapper around the engine
  /content       Explainer text, kept separate from code for easy editing

### Engine rules
- Deterministic: same seed + same player inputs = identical outcome. This
  enables replays, fair leaderboards, and reliable tests.
- Event-driven simulated time; never use Date.now() or setTimeout inside /engine.
- Price-time priority matching. Support limit orders, market orders, cancels.
  Partial fills must work correctly.
- Prices are integers (ticks), never floats.
- The engine exposes a clean API: submit(order), cancel(id), step(untilTime),
  and an event stream (fills, book updates, trades).
- The player is just another participant with its own latency profile; no
  special-casing the player inside the matching logic.

### Time and event scheduling
Decided: the event queue lives in `Simulation` (via `Scheduler`), not inside
`MatchingEngine.step()`.

- `scheduler.ts` owns simulated time and a binary-heap event queue, ordered
  by `(time, insertion sequence)` so same-time events always run in the
  order they were scheduled. Nothing else in the engine tracks time.
- `orderBook.ts` and `matchingEngine.ts` are pure and time-agnostic: they
  receive orders and return fills, with no knowledge of time, latency, or
  bots. `Order` and `Fill` carry no timestamp — price-time priority falls
  out naturally from the order `submit()` is called in.
- `simulation.ts` is the orchestrator. It owns the `Scheduler` and the
  `MatchingEngine`, and is the only place latency is modeled: an order
  reaches the matching engine only after the submitting participant's
  outbound latency elapses, and each side of a fill learns about it only
  after its own return latency elapses — both are just callbacks scheduled
  later on the same queue, not a separate "latency system."

Why: keeps the matching logic simple and provably correct independent of
timing concerns; makes a run's determinism enforced in exactly one place
(the scheduler's tie-break order) instead of scattered across modules;
makes replays trivial (re-run the same scheduled-call sequence); and models
latency as "the future," which is what actually lets a faster bot beat a
slower one to a stale price in the Level 5 latency race — the book updates
the instant a faster order lands, before a slower participant's own
notification of that change has even arrived.

## Code standards
- Strict TypeScript, no `any`.
- Small, focused modules. Engine code must be readable by a student who wants
  to learn from it — clarity over cleverness, with brief comments explaining
  the market concept behind non-obvious logic.
- Every engine behavior has unit tests, especially: matching priority, partial
  fills, cancels, and determinism (same seed → same result).
- UI components stay dumb; game logic lives in the engine or level definitions.

## Educational tone
- Plain language, short sentences, no jargon without an immediate explanation.
- Show, don't tell: prefer an animation or a "what just happened" replay over a
  paragraph.
- Be accurate. Simplify, but never teach something false about how markets work.
  Add a "Deeper dive" note where a simplification hides important detail.
- Include a clear disclaimer: educational simulation, not financial advice.

## How to work with me (instructions for Claude)
- Before large changes, propose a short plan and wait for my approval.
- Build in small, working increments; the app should run after every step.
- Run tests and the type checker before saying a task is done.
- When you make a design decision I didn't specify, state it in one line.
- If something in these instructions conflicts with good practice, say so
  instead of silently following or ignoring it.
- Keep a running TODO.md with next steps and open questions.

## Roadmap (after the MVP)
1. Polish + launch: shareable score images, landing page, post on HN/Reddit.
2. Interactive explainer articles (e.g., "the life of an order in 40µs") that
   link into the game.
3. Daily challenge with a fixed seed and a global leaderboard (adds a small backend).
4. Bot-vs-bot arena: players write strategies in JS/Python in the browser.
5. Advanced track: high-performance engine (Rust → WASM) with latency labs
   for engineering-minded users.
6. Sponsored competitions for recruiting.