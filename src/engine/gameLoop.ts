import { GAME_MODES } from '../data/modes'
import type { GameModeConfig } from '../data/modes'
import type { GameModeId, GameState, GameType, LogEntry, MarketEvent, PlayerState, TravelEvent, WorldState } from '../types/game'
import { initializeMarket, refreshMarket, applyMarketEvents, updateWorldMarkets, generateMarketEvent } from './market'
import { getAdjacentRoads, getRoadDestination, selectTravelEvent } from './travel'
import { applyTurnInterest, addChemStash, payBrotherhoodToll, calculateFinalScore, applyGuardSalary } from './economy'
import { initiateCombat } from './combat'
import { awardXp, getScaleFactor, XpEventType } from './xp'
import { rng } from './rng'

export { getScaleFactor } from './xp'

function makeLog(turn: number, message: string, type: LogEntry['type']): LogEntry {
  return { turn, message, type }
}

// Each game type owns its own opening context line.
const GAME_START_CONTEXT: Record<GameType, (mc: GameModeConfig) => string> = {
  standard:  mc => `You have ${mc.maxTurns} turns to pay it off and make your fortune.`,
  free_play: ()  => 'FREE PLAY: No turn limit. Danger scales with time. Earn XP — survive as long as you can.',
}

function buildStartLog(
  characterName: string,
  mc: GameModeConfig,
  events: MarketEvent[],
  gameType: GameType,
): LogEntry[] {
  const log: LogEntry[] = [
    makeLog(1, `Welcome to the ${mc.name}, ${characterName}.`, 'system'),
    makeLog(1, `You start with ${mc.startingCaps} caps and a ${mc.startingDebt} cap debt.`, 'system'),
    makeLog(1, GAME_START_CONTEXT[gameType](mc), 'system'),
  ]
  for (const e of events) {
    log.push(makeLog(1, `[MARKET INTEL] ${e.message}`, 'danger'))
  }
  return log
}

export function initializeGame(
  characterName: string,
  modeId: GameModeId = 'commonwealth',
  gameType: GameType = 'standard',
): GameState {
  const mc = GAME_MODES[modeId]

  const player: PlayerState = {
    name: characterName,
    caps: mc.startingCaps,
    debt: mc.startingDebt,
    health: mc.startingHealth,
    maxHealth: mc.startingHealth,
    guards: 0,
    powerArmorGuards: 0,
    brahmin: mc.startingBrahmin,
    location: mc.startingLocation,
    ageOfDebt: 0,
    inventory: {},
    gun: null,
    ownedGuns: {},
    armor: null,
    tamingTool: null,
    hasSaddle: false,
    mount: null,
    xp: 0,
    visitedSettlements: [mc.startingLocation],
    debtPaidThisCycle: 0,
    debtWarnings: 0,
    debtWindowCapsPaid: 0,
    debtWindowStartAge: mc.debtGracePeriod,
    conditions: [],
  }

  const settlements: WorldState['settlements'] = {}
  for (const id of mc.settlementIds) {
    const s = mc.settlements[id]
    settlements[id] = initializeMarket(1, mc.availableChemIds, s?.priceModifier, s?.stockMultiplier, s?.availabilityBonus)
  }

  // Seed 2 market events on turn 1 as advance intelligence for the player
  const events = []
  for (let i = 0; i < 2; i++) {
    const e = generateMarketEvent(1, mc)
    if (e) events.push(e)
  }

  const world: WorldState = {
    turn: 1,
    maxTurns: gameType === 'free_play' ? null : mc.maxTurns,
    settlements,
    activeMarketEvents: events,
  }

  const log = buildStartLog(characterName, mc, events, gameType)

  return {
    mode: modeId,
    gameType,
    player,
    world,
    phase: 'settlement',
    pendingEvent: null,
    pendingDestination: null,
    pendingQuote: null,
    combat: null,
    gameOverReason: null,
    endReason: null,
    log,
  }
}

// Phase 1: show the transit splash with an overheard quote.
// Debt and event resolution happen in continueTravel when the player clicks Continue.
export function startTravel(state: GameState, destinationId: string): GameState {
  const mc = GAME_MODES[state.mode]
  const roads = getAdjacentRoads(mc, state.player.location)
  const road = roads.find(r => getRoadDestination(r, state.player.location) === destinationId)
  if (!road) return state

  const destName = mc.settlements[destinationId]?.name ?? destinationId
  const log = [...state.log, makeLog(state.world.turn, `Heading to ${destName} via ${road.name}...`, 'info')]

  const q = rng() < 0.33
    ? mc.transitQuotes[Math.floor(rng() * mc.transitQuotes.length)]
    : null

  return {
    ...state,
    phase: 'traveling',
    pendingDestination: destinationId,
    pendingEvent: null,
    pendingQuote: q ?? null,
    log,
  }
}

// Phase 2: apply debt, select event, and either enter the event phase or arrive.
export function continueTravel(state: GameState): GameState {
  const destinationId = state.pendingDestination
  if (!destinationId) return state

  const mc = GAME_MODES[state.mode]
  const roads = getAdjacentRoads(mc, state.player.location)
  const road = roads.find(r => getRoadDestination(r, state.player.location) === destinationId)
  if (!road) return state

  let player = { ...state.player }
  const log = [...state.log]

  // Snapshot payment before the tick resets it
  const debtPaidThisCycle = player.debtPaidThisCycle ?? 0

  // Apply interest tick (grows debt, increments ageOfDebt, resets debtPaidThisCycle)
  player = applyTurnInterest(player, mc.interestRate)

  // Update payment window using post-interest debt as the threshold baseline.
  // If cumulative window payment meets 15% of current debt, open a fresh window.
  if (player.debt > 0) {
    const netPaidThisCycle = Math.max(0, debtPaidThisCycle - (player.debtBorrowedThisCycle ?? 0))
    const windowCapsPaid = (player.debtWindowCapsPaid ?? 0) + netPaidThisCycle
    const minWindowPayment = Math.ceil(player.debt * mc.debtMinPaymentRate)
    const windowSatisfied = windowCapsPaid >= minWindowPayment
    player = {
      ...player,
      debtWindowCapsPaid:   windowSatisfied ? 0 : windowCapsPaid,
      debtWindowStartAge:   windowSatisfied ? player.ageOfDebt : (player.debtWindowStartAge ?? player.ageOfDebt),
      debtWindowMinPayment: windowSatisfied ? minWindowPayment : (player.debtWindowMinPayment ?? minWindowPayment),
    }
  }

  // Radscorpion venom DoT — drains 5 HP per travel turn until cured
  if (player.conditions?.some(c => c.type === 'radscorpion_venom')) {
    const newHealth = Math.max(0, player.health - 5)
    log.push(makeLog(state.world.turn, 'Radscorpion venom burns through you. -5 HP.', 'danger'))
    player = { ...player, health: newHealth }
    if (newHealth <= 0) {
      return {
        ...state,
        player,
        log,
        phase: 'game_over',
        gameOverReason: 'combat',
        endReason: 'Killed by radscorpion venom',
        pendingEvent: null,
        pendingDestination: null,
      }
    }
  }

  // Cazador venom DoT — drains 10 HP per travel turn until cured
  if (player.conditions?.some(c => c.type === 'cazador_venom')) {
    const newHealth = Math.max(0, player.health - 10)
    log.push(makeLog(state.world.turn, 'Cazador venom eats at you. -10 HP.', 'danger'))
    player = { ...player, health: newHealth }
    if (newHealth <= 0) {
      return {
        ...state,
        player,
        log,
        phase: 'game_over',
        gameOverReason: 'combat',
        endReason: 'Killed by cazador venom',
        pendingEvent: null,
        pendingDestination: null,
      }
    }
  }

  const sf = getScaleFactor(state.world.turn, state.gameType)
  const { player: p1, logMessage: xpMsg1 } = awardXp(player, { type: XpEventType.RoadTravel, dangerLevel: road.dangerLevel, scaleFactor: sf })
  player = p1
  if (xpMsg1) log.push(makeLog(state.world.turn, xpMsg1, 'profit'))

  // Select a travel event
  const event = selectTravelEvent(road, player, mc, sf, state.world.turn, state.gameType)
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
  const mc = GAME_MODES[state.mode]
  let player = { ...state.player, location: destinationId }
  const turn = state.world.turn + 1

  // Refresh destination market
  let world = { ...state.world, turn }
  world = updateWorldMarkets(world, mc)
  world = {
    ...world,
    settlements: {
      ...world.settlements,
      [destinationId]: applyMarketEvents(
        refreshMarket(world.settlements[destinationId], turn, mc.availableChemIds, mc.settlements[destinationId]?.priceModifier, mc.settlements[destinationId]?.stockMultiplier, mc.settlements[destinationId]?.availabilityBonus),
        world.activeMarketEvents,
        destinationId,
      ),
    },
  }

  // Guard salary — deduct each turn, desert if can't cover
  const { player: playerAfterSalary, logs: salaryLogs } = applyGuardSalary(player, mc)
  player = playerAfterSalary
  const log = [...state.log]
  for (const { message, type } of salaryLogs) log.push(makeLog(turn, message, type))

  const destName = mc.settlements[destinationId]?.name ?? destinationId
  log.push(makeLog(turn, `Arrived at ${destName}.`, 'info'))

  // Settlement discovery XP (first visit per run)
  const visited = player.visitedSettlements ?? []
  let pendingDiscovery: GameState['pendingDiscovery'] = null
  if (!visited.includes(destinationId)) {
    const { player: p2, logMessage: xpMsg2 } = awardXp(player, { type: XpEventType.SettlementDiscovery, settlementName: destName })
    const xpGained = p2.xp - player.xp
    player = { ...p2, visitedSettlements: [...visited, destinationId] }
    pendingDiscovery = { settlementId: destinationId, xpGained }
    if (xpMsg2) log.push(makeLog(turn, xpMsg2, 'profit'))
  } else {
    player = { ...player, visitedSettlements: visited }
  }

  // Announce any active market events
  for (const e of world.activeMarketEvents) {
    log.push(makeLog(turn, `[MARKET] ${e.message} (${e.turnsRemaining} turn${e.turnsRemaining > 1 ? 's' : ''} remaining)`, 'danger'))
  }

  // Check win condition (standard mode only — free play has no turn limit)
  if (world.maxTurns !== null && turn > world.maxTurns) {
    const score = calculateFinalScore(player)
    log.push(makeLog(turn, `Time's up. Final score: ${score} caps.`, 'system'))
    return {
      ...state,
      player,
      world,
      phase: 'game_over',
      gameOverReason: 'turns',
      endReason: 'Turn limit reached',
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
    pendingDiscovery,
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

// Consume a turn without changing location — used when travel is aborted mid-road.
// Increments world.turn, ticks market events, and checks the turn-limit win condition.
function consumeTurnInPlace(state: GameState, message: string, logType: LogEntry['type']): GameState {
  const mc = GAME_MODES[state.mode]
  const turn = state.world.turn + 1
  let world = { ...state.world, turn }
  world = updateWorldMarkets(world, mc)
  const log = [...state.log, makeLog(turn, message, logType)]

  if (world.maxTurns !== null && turn > world.maxTurns) {
    const score = calculateFinalScore(state.player)
    log.push(makeLog(turn, `Time's up. Final score: ${score} caps.`, 'system'))
    return {
      ...state,
      world,
      phase: 'game_over',
      gameOverReason: 'turns',
      endReason: 'Turn limit reached',
      pendingEvent: null,
      pendingDestination: null,
      log,
    }
  }

  return {
    ...state,
    world,
    phase: 'settlement',
    pendingEvent: null,
    pendingDestination: null,
    log,
  }
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
      return consumeTurnInPlace(state, "You can't afford the toll. The wasted journey costs you a turn.", 'danger')
    }
    log.push(makeLog(state.world.turn, `You pay the ${toll} cap checkpoint toll and pass through.`, 'info'))
    return completeTravel({ ...state, player, log }, dest)
  } else {
    return consumeTurnInPlace(state, "You turn back from the checkpoint. The wasted journey costs you a turn.", 'danger')
  }
}

export function resolveDebtCollector(state: GameState): GameState {
  const dest = state.pendingDestination
  const turn = state.world.turn
  const mc   = GAME_MODES[state.mode]
  let player = { ...state.player }
  const log  = [...state.log]

  const warnings = player.debtWarnings ?? 0
  const collectorName =
    mc.id === 'capital_wasteland' ? 'Talon Company' :
    mc.id === 'mojave_wasteland'  ? 'Legion Assassins' :
    'Triggermen'

  // Pick the enforcement entry matching the warning level (clamp to last entry)
  const idx        = Math.min(warnings, mc.debtEnforcement.length - 1)
  const enforcement = mc.debtEnforcement[idx]
  const isKill     = enforcement.damage >= 999
  const debtEndReason = `Killed by ${collectorName} (debt)`

  log.push(makeLog(turn, enforcement.message, 'danger'))

  if (isKill) {
    return {
      ...state,
      player: { ...player, health: 0 },
      phase: 'game_over',
      gameOverReason: 'debt',
      endReason: debtEndReason,
      pendingEvent: null,
      pendingDestination: null,
      log,
    }
  }

  player = {
    ...player,
    health: Math.max(1, player.health - enforcement.damage),
    debtWarnings: warnings + 1,
  }

  return completeTravel({ ...state, player, log }, dest ?? state.player.location)
}

export function startCombat(state: GameState): GameState {
  const dest = state.pendingDestination
  const mc = GAME_MODES[state.mode]
  const road = dest
    ? mc.roads.find(r =>
        (r.from === state.player.location && r.to === dest) ||
        (r.to === state.player.location && r.from === dest)
      )
    : null

  const payload = state.pendingEvent?.payload as { enemyTypeId?: string; count?: number } | undefined
  const forcedTypeId = payload?.enemyTypeId
  const forcedCount  = payload?.count
  const sf = getScaleFactor(state.world.turn, state.gameType)
  const combat = initiateCombat(road?.dangerLevel ?? 0.5, mc, road?.enemyWeights, forcedTypeId, forcedCount, sf, state.world.turn, state.gameType)
  return {
    ...state,
    phase: 'combat',
    combat,
    log: [...state.log, makeLog(state.world.turn, `COMBAT: ${combat.log[0]}`, 'danger')],
  }
}

// Danger threshold above which a second enemy wave can spawn.
const SECOND_WAVE_MIN_DANGER = 0.55

export function afterCombat(state: GameState, result: { player: PlayerState; combat: import('../types/game').CombatState }): GameState {
  let { player, combat } = result
  const dest = state.pendingDestination
  const turn = state.world.turn
  const newLogs = combat.log.slice(state.combat?.log.length ?? 0).map(m => makeLog(turn, m, 'danger'))

  if (combat.phase === 'lost') {
    const mc = GAME_MODES[state.mode]
    const killerTypeId = combat.enemies[0]?.typeId
    const killerType = mc.enemies.find(e => e.id === killerTypeId)
    const killerName = killerType?.name ?? 'enemies'
    return {
      ...state,
      player,
      combat,
      phase: 'game_over',
      gameOverReason: 'combat',
      endReason: `Killed by ${killerName}s on the road`,
      log: [...state.log, ...newLogs],
    }
  }

  if (combat.phase === 'won') {
    const mc = GAME_MODES[state.mode]
    const killedEnemies = combat.enemies.filter(e => e.dead)
    const xpFromKills = killedEnemies.reduce((sum, e) => sum + (mc.enemyStats[e.typeId]?.xpReward ?? 15), 0)
    const { player: p4, logMessage: xpMsg4 } = awardXp(player, { type: XpEventType.CombatVictory, xpFromKills, killCount: killedEnemies.length })
    const xpGained = p4.xp - player.xp
    player = p4
    combat = { ...combat, xpGained }
    if (xpMsg4) newLogs.push(makeLog(turn, xpMsg4, 'profit'))
  }

  // Post-combat venom: apply persistent conditions from combat
  if (combat.phase === 'won' || combat.phase === 'fled') {
    const enemyTypeId = combat.enemies[0]?.typeId
    if (combat.totalDamageTaken > 0 && enemyTypeId === 'radscorpion' && !player.conditions?.some(c => c.type === 'radscorpion_venom')) {
      player = { ...player, conditions: [...(player.conditions ?? []), { type: 'radscorpion_venom' as const }] }
      newLogs.push(makeLog(turn, "The radscorpion's sting left venom in your blood. You'll need antivenom.", 'danger'))
    }
    if (combat.playerVenomed && !player.conditions?.some(c => c.type === 'cazador_venom')) {
      player = { ...player, conditions: [...(player.conditions ?? []), { type: 'cazador_venom' as const }] }
      newLogs.push(makeLog(turn, "Cazador venom is still in your system. -10 HP per turn until cured.", 'danger'))
    }
    combat = { ...combat, playerVenomed: false }
    // Clear weapon cooldown between combats — the player has time to reload
    if (player.gun?.cooldownRemaining) {
      const clearedGun = { ...player.gun, cooldownRemaining: 0 }
      const clearedOwned = player.ownedGuns[player.gun.id]
        ? { ...player.ownedGuns, [player.gun.id]: clearedGun }
        : player.ownedGuns
      player = { ...player, gun: clearedGun, ownedGuns: clearedOwned }
    }
  }

  const resolvedState = { ...state, player, combat, log: [...state.log, ...newLogs] }

  if ((combat.phase === 'won' || combat.phase === 'fled') && dest) {
    const mc = GAME_MODES[state.mode]
    const isFirstEncounter = !state.pendingEvent?.payload?.['isSecondEncounter']
    if (isFirstEncounter) {
      const road = mc.roads.find(r =>
        (r.from === player.location && r.to === dest) ||
        (r.to   === player.location && r.from === dest)
      )
      if (road && road.dangerLevel >= SECOND_WAVE_MIN_DANGER && rng() < road.dangerLevel - 0.40) {
        const warningMsg = combat.phase === 'won'
          ? 'You push forward — only to find another pack closing in.'
          : 'Still running — and you sprint right into a second ambush.'
        const sf = getScaleFactor(turn, state.gameType)
        const preview = initiateCombat(road.dangerLevel, mc, road.enemyWeights, undefined, undefined, sf, turn, state.gameType)
        const previewTypeId = preview.enemies[0]?.typeId
        const previewCount  = preview.enemies.length
        const previewName   = mc.enemies.find(e => e.id === previewTypeId)?.name ?? 'enemies'
        const secondWave: TravelEvent = {
          type: 'raider_ambush',
          title: 'SECOND WAVE!',
          description: preview.log[0],
          payload: {
            isSecondEncounter: true,
            enemyTypeId: previewTypeId,
            count: previewCount,
            enemyName: previewName,
            forfeitCaps: combat.capsLooted,
            forfeitChems: combat.enemyLoot,
          },
        }
        return {
          ...resolvedState,
          phase: 'event',
          pendingEvent: secondWave,
          log: [...resolvedState.log, makeLog(turn, warningMsg, 'danger')],
        }
      }
    }
    return { ...resolvedState, phase: 'combat_summary' }
  }

  return resolvedState
}

export function dismissCombatSummary(state: GameState): GameState {
  const dest = state.pendingDestination
  return completeTravel({ ...state, phase: 'combat' }, dest ?? state.player.location)
}

export function endGame(state: GameState): GameState {
  return { ...state, phase: 'game_over' }
}

export function retireGame(state: GameState): GameState {
  const score = calculateFinalScore(state.player)
  const turn = state.world.turn
  const log = [
    ...state.log,
    makeLog(turn, 'You hang up your pack and retire from the caravan trade.', 'system'),
    makeLog(turn, `Final XP: ${(state.player.xp ?? 0).toLocaleString()} · Caps on hand: ${state.player.caps.toLocaleString()} · Score: ${score >= 0 ? '+' : ''}${score}`, 'system'),
  ]
  return {
    ...state,
    phase: 'game_over',
    gameOverReason: 'retired',
    endReason: 'Retired from the caravan trade',
    pendingEvent: null,
    pendingDestination: null,
    combat: null,
    log,
  }
}
