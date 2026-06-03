import { SETTLEMENT_IDS, SETTLEMENTS } from '../data/settlements'
import { CONFIG } from '../data/config'
import type { GameState, LogEntry, PlayerState, TravelEvent, WorldState } from '../types/game'
import { initializeMarket, refreshMarket, applyMarketEvents, updateWorldMarkets, generateMarketEvent } from './market'
import { getAdjacentRoads, getRoadDestination, selectTravelEvent } from './travel'
import { applyTurnInterest, checkDebtEnforcement, addChemStash, payBrotherhoodToll, calculateFinalScore } from './economy'
import { initiateCombat } from './combat'
import { rng } from './rng'
import { pickQuote } from '../data/quotes'
import { ROADS } from '../data/settlements'

function makeLog(turn: number, message: string, type: LogEntry['type']): LogEntry {
  return { turn, message, type }
}

export function initializeGame(characterName: string): GameState {
  const player: PlayerState = {
    name: characterName,
    caps: CONFIG.STARTING_CAPS,
    bank: 0,
    debt: CONFIG.STARTING_DEBT,
    health: CONFIG.STARTING_HEALTH,
    maxHealth: CONFIG.STARTING_HEALTH,
    guards: 0,
    brahmin: CONFIG.STARTING_BRAHMIN,
    location: 'diamond_city',
    ageOfDebt: 0,
    inventory: {},
    gun: null,
  }

  const settlements: WorldState['settlements'] = {}
  for (const id of SETTLEMENT_IDS) {
    settlements[id] = initializeMarket(1)
  }

  // Seed 2 market events on turn 1 as advance intelligence for the player
  const events = []
  for (let i = 0; i < 2; i++) {
    const e = generateMarketEvent(1)
    if (e) events.push(e)
  }

  const world: WorldState = {
    turn: 1,
    maxTurns: CONFIG.MAX_TURNS,
    settlements,
    activeMarketEvents: events,
  }

  const log: LogEntry[] = [
    makeLog(1, `Welcome to the Commonwealth, ${characterName}.`, 'system'),
    makeLog(1, `You start in Diamond City with ${CONFIG.STARTING_CAPS} caps and a ${CONFIG.STARTING_DEBT} cap debt.`, 'system'),
    makeLog(1, `You have ${CONFIG.MAX_TURNS} turns to pay it off and make your fortune.`, 'system'),
  ]

  if (events.length > 0) {
    for (const e of events) {
      log.push(makeLog(1, `[MARKET INTEL] ${e.message}`, 'danger'))
    }
  }

  return {
    player,
    world,
    phase: 'settlement',
    pendingEvent: null,
    pendingDestination: null,
    pendingQuote: null,
    combat: null,
    gameOverReason: null,
    log,
  }
}

// Phase 1: show the transit splash with an overheard quote.
// Debt and event resolution happen in continueTravel when the player clicks Continue.
export function startTravel(state: GameState, destinationId: string): GameState {
  const roads = getAdjacentRoads(state.player.location)
  const road = roads.find(r => getRoadDestination(r, state.player.location) === destinationId)
  if (!road) return state

  const log = [...state.log, makeLog(state.world.turn, `Heading to ${SETTLEMENTS[destinationId].name} via ${road.name}...`, 'info')]

  return {
    ...state,
    phase: 'traveling',
    pendingDestination: destinationId,
    pendingEvent: null,
    pendingQuote: pickQuote(),
    log,
  }
}

// Phase 2: apply debt, select event, and either enter the event phase or arrive.
export function continueTravel(state: GameState): GameState {
  const destinationId = state.pendingDestination
  if (!destinationId) return state

  const roads = getAdjacentRoads(state.player.location)
  const road = roads.find(r => getRoadDestination(r, state.player.location) === destinationId)
  if (!road) return state

  let player = { ...state.player }
  const log = [...state.log]

  // Apply interest and check debt enforcement
  player = applyTurnInterest(player)
  const enforcement = checkDebtEnforcement(player)

  if (enforcement.action === 'kill') {
    log.push(makeLog(state.world.turn, enforcement.message, 'danger'))
    return {
      ...state,
      player: { ...player, health: 0 },
      phase: 'game_over',
      gameOverReason: 'debt',
      pendingQuote: null,
      log,
    }
  }

  if (enforcement.action === 'beat') {
    player = { ...player, health: Math.max(0, player.health - enforcement.damage) }
    log.push(makeLog(state.world.turn, enforcement.message, 'danger'))
    if (player.debt > 0) {
      log.push(makeLog(state.world.turn, `Outstanding debt: ${player.debt} caps. Interest: ${Math.round(player.debt * CONFIG.INTEREST_RATE)} caps/turn.`, 'danger'))
    }
  }

  // Select a travel event, if any
  const event = selectTravelEvent(road, player)
  if (event) {
    return {
      ...state,
      player,
      phase: 'event',
      pendingEvent: event,
      pendingQuote: null,
      log,
    }
  }

  // No event — arrive directly
  return completeTravel({ ...state, player, pendingQuote: null, log }, destinationId)
}

export function completeTravel(state: GameState, destinationId: string): GameState {
  let player = { ...state.player, location: destinationId }
  const turn = state.world.turn + 1

  // Refresh destination market
  let world = { ...state.world, turn }
  world = updateWorldMarkets(world)
  world = {
    ...world,
    settlements: {
      ...world.settlements,
      [destinationId]: applyMarketEvents(
        refreshMarket(world.settlements[destinationId], turn),
        world.activeMarketEvents,
        destinationId,
      ),
    },
  }

  const log = [...state.log, makeLog(turn, `Arrived at ${SETTLEMENTS[destinationId].name}.`, 'info')]

  // Announce any active market events
  for (const e of world.activeMarketEvents) {
    log.push(makeLog(turn, `[MARKET] ${e.message} (${e.turnsRemaining} turn${e.turnsRemaining > 1 ? 's' : ''} remaining)`, 'danger'))
  }

  // Check win condition
  if (turn > world.maxTurns) {
    const score = calculateFinalScore(player)
    log.push(makeLog(turn, `Time's up. Final score: ${score} caps.`, 'system'))
    return {
      ...state,
      player,
      world,
      phase: 'game_over',
      gameOverReason: 'turns',
      pendingEvent: null,
      pendingDestination: null,
      combat: null,
      log,
    }
  }

  return {
    ...state,
    player,
    world,
    phase: 'settlement',
    pendingEvent: null,
    pendingDestination: null,
    combat: null,
    log,
  }
}

export function resolveChemStash(state: GameState): GameState {
  const event = state.pendingEvent
  const dest = state.pendingDestination
  if (!event || event.type !== 'chem_stash' || !dest) return completeTravel(state, dest ?? state.player.location)

  const { chemId, qty } = event.payload as { chemId: string; qty: number }
  const player = addChemStash(state.player, chemId, qty as number)
  const log = [...state.log, makeLog(state.world.turn, `Found ${qty} ${chemId} in an abandoned pack!`, 'profit')]

  return completeTravel({ ...state, player, log }, dest)
}

export function resolveBrotherhoodToll(state: GameState, pay: boolean): GameState {
  const event = state.pendingEvent
  const dest = state.pendingDestination
  if (!event || event.type !== 'brotherhood_checkpoint' || !dest) return completeTravel(state, dest ?? state.player.location)

  const toll = (event.payload as { toll: number }).toll
  const log = [...state.log]

  if (pay) {
    const { player, paid } = payBrotherhoodToll(state.player, toll)
    if (!paid) {
      log.push(makeLog(state.world.turn, "You can't pay the toll. The Paladins turn you back.", 'danger'))
      return {
        ...state,
        player,
        phase: 'settlement',
        pendingEvent: null,
        pendingDestination: null,
        log,
      }
    }
    log.push(makeLog(state.world.turn, `You pay the ${toll} cap Brotherhood toll and pass through.`, 'info'))
    return completeTravel({ ...state, player, log }, dest)
  } else {
    log.push(makeLog(state.world.turn, "You refuse to pay. The Brotherhood turns you back at gunpoint.", 'danger'))
    return {
      ...state,
      phase: 'settlement',
      pendingEvent: null,
      pendingDestination: null,
      log,
    }
  }
}

export function resolveDebtCollector(state: GameState): GameState {
  const dest = state.pendingDestination
  const turn = state.world.turn
  let player = { ...state.player }
  const log = [...state.log]

  const damage = 20
  player = { ...player, health: Math.max(0, player.health - damage) }
  log.push(makeLog(turn, `The Triggermen rough you up for ${damage} damage. "Pay your debts, friend."`, 'danger'))

  if (player.health <= 0) {
    log.push(makeLog(turn, "You don't survive the beating.", 'danger'))
    return {
      ...state,
      player,
      phase: 'game_over',
      gameOverReason: 'debt',
      pendingEvent: null,
      pendingDestination: null,
      log,
    }
  }

  if (dest) return completeTravel({ ...state, player, log }, dest)
  return { ...state, player, phase: 'settlement', pendingEvent: null, pendingDestination: null, log }
}

export function startCombat(state: GameState): GameState {
  const dest = state.pendingDestination
  const road = dest
    ? ROADS.find(r =>
        (r.from === state.player.location && r.to === dest) ||
        (r.to === state.player.location && r.from === dest)
      )
    : null

  const combat = initiateCombat(road?.dangerLevel ?? 0.5)
  return {
    ...state,
    phase: 'combat',
    combat,
    log: [...state.log, makeLog(state.world.turn, `COMBAT: ${combat.log[0]}`, 'danger')],
  }
}

// Danger threshold above which a second raider wave can spawn.
// Probability = dangerLevel - 0.40 (25% at 0.65, 30% at 0.70, 35% at 0.75).
const SECOND_WAVE_MIN_DANGER = 0.65

export function afterCombat(state: GameState, result: { player: PlayerState; combat: import('../types/game').CombatState }): GameState {
  const { player, combat } = result
  const dest = state.pendingDestination
  const turn = state.world.turn
  const newLogs = combat.log.slice(state.combat?.log.length ?? 0).map(m => makeLog(turn, m, 'danger'))

  if (combat.phase === 'lost') {
    return {
      ...state,
      player,
      combat,
      phase: 'game_over',
      gameOverReason: 'combat',
      log: [...state.log, ...newLogs],
    }
  }

  const resolvedState = { ...state, player, combat, log: [...state.log, ...newLogs] }

  if ((combat.phase === 'won' || combat.phase === 'fled') && dest) {
    // On dangerous roads, roll for a second raider wave.
    // Only on the first encounter (payload flag prevents a third).
    const isFirstEncounter = !state.pendingEvent?.payload?.['isSecondEncounter']
    if (isFirstEncounter) {
      const road = ROADS.find(r =>
        (r.from === player.location && r.to === dest) ||
        (r.to   === player.location && r.from === dest)
      )
      if (road && road.dangerLevel >= SECOND_WAVE_MIN_DANGER && rng() < road.dangerLevel - 0.40) {
        const warningMsg = combat.phase === 'won'
          ? 'You push forward — only to find another raider pack closing in.'
          : 'Still running — and you sprint right into a second ambush.'
        const secondWave: TravelEvent = {
          type: 'raider_ambush',
          title: 'SECOND WAVE!',
          description: 'More Raiders emerge from cover. This road earns its reputation.',
          payload: { isSecondEncounter: true },
        }
        return {
          ...resolvedState,
          phase: 'event',
          pendingEvent: secondWave,
          log: [...resolvedState.log, makeLog(turn, warningMsg, 'danger')],
        }
      }
    }
    return completeTravel(resolvedState, dest)
  }

  return resolvedState
}

export function endGame(state: GameState): GameState {
  return { ...state, phase: 'game_over' }
}
