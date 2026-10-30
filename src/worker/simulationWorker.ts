import { BotRunner } from '../engine/botRunner'
import { NoiseTrader } from '../engine/bots/noiseTrader'
import { LatencyModel } from '../engine/latency'
import { Rng } from '../engine/rng'
import { Simulation } from '../engine/simulation'
import type { WorkerRequest, WorkerUpdateMessage } from './messages'

// This file is the one place in the whole engine stack allowed to touch
// wall-clock time: it's infrastructure translating real time into steady
// advances of simulated time, not simulation logic itself. Everything it
// calls into (Simulation, BotRunner, MatchingEngine) stays event-driven.

let simulation: Simulation | undefined
let botRunner: BotRunner | undefined
let playerParticipantId: string | undefined
let tickIntervalSimTime = 1
let intervalId: ReturnType<typeof setInterval> | undefined

function postUpdate(): void {
  if (simulation === undefined) return
  const message: WorkerUpdateMessage = {
    type: 'update',
    time: simulation.now(),
    snapshot: simulation.snapshot(),
    log: simulation.drainLog(),
  }
  postMessage(message)
}

function handleInit(request: Extract<WorkerRequest, { type: 'init' }>): void {
  const latency = new LatencyModel(new Rng(request.seed))
  latency.setProfile(request.playerParticipantId, request.playerLatency)
  playerParticipantId = request.playerParticipantId
  tickIntervalSimTime = request.tickIntervalSimTime

  const bots = request.noiseTraders.map((entry) => {
    latency.setProfile(entry.config.participantId, entry.latency)
    return new NoiseTrader(entry.config, new Rng(entry.rngSeed))
  })

  simulation = new Simulation(latency)
  botRunner = new BotRunner(simulation, bots, tickIntervalSimTime)

  intervalId = setInterval(() => {
    botRunner?.runUntil((simulation?.now() ?? 0) + tickIntervalSimTime)
    postUpdate()
  }, request.realTimeMsPerTick)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  if (request.type === 'init') {
    handleInit(request)
    return
  }
  if (simulation === undefined || playerParticipantId === undefined) return // init hasn't run yet

  if (request.type === 'submit') {
    simulation.submit(request.order)
  } else if (request.type === 'cancel') {
    simulation.cancel(playerParticipantId, request.orderId)
  } else if (request.type === 'stop') {
    if (intervalId !== undefined) clearInterval(intervalId)
  }
}
