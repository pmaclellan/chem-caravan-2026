import { create } from 'zustand'
import pkg from '../../package.json'
import { supabase } from '../lib/supabase'
import { GAME_MODES } from '../data/modes'
import { GUARD_CLASSES } from '../data/guardClasses'
import { CHEMS } from '../data/chems'
import type { ActiveBuff, AnimStep, GameState, GameRow, GameModeId, GameType, GuardClassId, ActiveGameSummary, PlayerState, CombatState } from '../types/game'
import {
  initializeGame,
  startTravel,
  continueTravel,
  completeTravel,
  resolveChemStash,
  resolveBrotherhoodToll,
  resolveDebtCollector,
  startCombat,
  afterCombat,
  dismissCombatSummary,
  retireGame as retireGameFn,
} from '../engine/gameLoop'
import { resolveFight, resolveRun } from '../engine/combat'
import { canAttemptTame, resolveTameSuccess, resolveFailedTame } from '../engine/taming'
import { loseBrahmin } from '../engine/travel'
import { rng } from '../engine/rng'
import {
  buyChems,
  sellChems,
  healPlayer,
  takeLoan,
  repayDebt,
  hireGuards,
  buyPowerArmorGuard,
  buyBrahmin,
  buyGun,
  equipGun as equipGunFn,
  buyAmmo,
  buyArmor,
  repairArmor,
  buyTamingTool,
  buySaddle,
  healMount as healMountFn,
  calculateFinalScore,
  resolveGameStatus,
} from '../engine/economy'
import { gameBus } from '../engine/eventBus'
import { initStats, updateStats } from '../engine/statsReducer'
import { checkNewAchievements, checkProfitAchievements } from '../engine/achievementChecker'
import { ACHIEVEMENT_MAP } from '../data/achievements'
import { TAMING_TOOLS, SADDLE_PRICE } from '../data/mounts'
import type { TamingToolId } from '../types/game'
import { awardXp, addXpToStats, XpEventType } from '../engine/xp'
import type { SettlementMarket, WorldState } from '../types/game'
import { applyMarketEvents } from '../engine/market'

function encodeVersion(v: string): number {
  const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number)
  return major * 10000 + minor * 100 + patch
}

const CURRENT_GAME_VERSION = encodeVersion(pkg.version)

function updateSettlementStock(world: WorldState, loc: string, chemId: string, delta: number): WorldState {
  const prev = world.settlements[loc]?.stock[chemId] ?? 0
  return {
    ...world,
    settlements: {
      ...world.settlements,
      [loc]: {
        ...world.settlements[loc],
        stock: { ...world.settlements[loc].stock, [chemId]: Math.max(0, prev + delta) },
      },
    },
  }
}

// Applies a combat chem (Stimpak/Jet/Ultrajet) to the player or a guard mid-combat.
// Free action — doesn't consume the FIGHT/RUN turn — but capped at 1 use per round across the party.
function applyCombatChem(
  state: GameState,
  chemId: string,
  targetKind: 'player' | 'guard' | 'pa_guard',
  targetId: string,
): { state: GameState; error?: string } {
  const combat = state.combat
  if (!combat) return { state, error: 'Not in combat.' }
  if (combat.chemUsedThisRound) return { state, error: 'Already treated this round.' }

  const chem = CHEMS[chemId]
  const effect = chem?.combatEffect
  if (!effect) return { state, error: 'This chem has no combat use.' }

  const owned = state.player.inventory[chemId]
  if (!owned || owned.quantity < 1) return { state, error: `No ${chem.name} in inventory.` }

  let player = state.player
  let targetName: string

  if (targetKind === 'player') {
    targetName = 'yourself'
  } else if (targetKind === 'guard') {
    const idx = player.guards.findIndex(g => g.id === targetId)
    if (idx === -1 || player.guards[idx].dead) return { state, error: 'That guard is not available.' }
    targetName = `Guard ${idx + 1}`
  } else {
    const idx = player.paGuards.findIndex(g => g.id === targetId)
    if (idx === -1 || player.paGuards[idx].dead) return { state, error: 'That PA guard is not available.' }
    targetName = `PA Guard ${idx + 1}`
  }

  const newQty = owned.quantity - 1
  const inventory = { ...player.inventory }
  if (newQty === 0) delete inventory[chemId]
  else inventory[chemId] = { ...owned, quantity: newQty }
  player = { ...player, inventory }

  let newCombat: CombatState = combat
  let logMsg: string

  if (effect.kind === 'heal') {
    const healAmount = effect.healAmount ?? 0
    if (targetKind === 'player') {
      player = { ...player, health: Math.min(player.maxHealth, player.health + healAmount) }
    } else if (targetKind === 'guard') {
      player = { ...player, guards: player.guards.map(g => g.id === targetId ? { ...g, health: Math.min(g.maxHealth, g.health + healAmount) } : g) }
    } else {
      player = { ...player, paGuards: player.paGuards.map(g => g.id === targetId ? { ...g, health: Math.min(g.maxHealth, g.health + healAmount) } : g) }
    }
    logMsg = `${chem.name} administered to ${targetName}. +${healAmount} HP.`
  } else {
    const fraction = effect.accuracyBuffFraction ?? 0
    const duration = effect.buffDurationRounds ?? 2
    const mc = GAME_MODES[state.mode]
    const baseAccuracy =
      targetKind === 'player' ? (player.gun?.accuracy ?? 0) :
      targetKind === 'guard'  ? GUARD_CLASSES[player.guards.find(g => g.id === targetId)!.classId].accuracy :
                                mc.powerArmorGuardAccuracy
    const accuracyBonus = (1 - baseAccuracy) * fraction
    const newBuff: ActiveBuff = {
      id: `${chemId}_${targetId}_${combat.activeBuffs.length}_${state.world.turn}`,
      chemId,
      targetKind,
      targetId,
      accuracyBonus,
      roundsRemaining: duration,
    }
    const activeBuffs = [...combat.activeBuffs.filter(b => !(b.targetKind === targetKind && b.targetId === targetId)), newBuff]
    newCombat = { ...combat, activeBuffs }
    logMsg = `${chem.name} administered to ${targetName}. Accuracy boosted for ${duration} rounds.`
  }

  newCombat = { ...newCombat, chemUsedThisRound: true }
  const log = [...state.log, { turn: state.world.turn, message: logMsg, type: 'info' as const }]
  return { state: { ...state, player, combat: newCombat, log } }
}

interface GameStore {
  gameId: string | null
  gameState: GameState | null
  activeGameSummaries: Record<GameModeId, ActiveGameSummary | null> | null
  freePlaySummaries: Record<GameModeId, ActiveGameSummary | null>
  isSaving: boolean
  saveError: string | null
  toast: string | null

  // Combat animation — lives outside gameState so it doesn't trigger Supabase saves
  combatAnimSteps: AnimStep[] | null
  pendingFightResult: { player: PlayerState; combat: CombatState } | null
  showTamingMinigame: boolean

  // Lifecycle
  startNewGame: (characterName: string, userId: string, modeId?: GameModeId, gameType?: GameType) => Promise<void>
  loadActiveGame: (userId: string, modeId?: GameModeId) => Promise<void>
  loadActiveGames: (userId: string) => Promise<void>
  loadGameById: (gameId: string) => Promise<void>
  clearGame: () => void

  // Travel
  travelTo: (destinationId: string) => void
  continueTravel: () => void

  // Events
  resolveEvent: (choice: string) => void
  resolveChemStashSwap: (dropped: Record<string, number>, taken: Record<string, number>) => void

  // Combat
  fight: () => void
  run: () => void
  completeCombatAnim: () => void
  dismissCombatSummary: () => void
  openTamingMinigame: () => void
  completeTame: () => void
  abandonTame: () => void
  purchaseTamingTool: (toolId: TamingToolId) => void
  purchaseSaddle: () => void
  healMount: () => void

  // Market
  buy: (chemId: string, quantity: number) => void
  sell: (chemId: string, quantity: number) => void
  buyFromMerchant:  (chemId: string, quantity: number) => void
  sellToMerchant:   (chemId: string, quantity: number) => void

  // Services
  heal: () => void
  borrow: (amount: number) => void
  payDebt: (amount: number) => void
  hireguards: (classId: GuardClassId, count: number) => void
  purchasePowerArmorGuard: (count: number) => void
  purchaseBrahmin: (count: number) => void
  purchaseGun: (gunId: string) => void
  equipGun: (gunId: string) => void
  purchaseAmmo: (rounds: number) => void
  purchaseAmmoForGun: (gunId: string, rounds: number) => void
  purchaseArmor: (armorId: string) => void
  repairArmor: () => void
  retire: () => void
  buyAntivenom: () => void
  useAntivenom: () => void
  useStimpakInCombat: (targetKind: 'player' | 'guard' | 'pa_guard', targetId: string) => void
  useJetInCombat: (targetKind: 'player' | 'guard' | 'pa_guard', targetId: string) => void
  useUltrajetInCombat: (targetKind: 'player' | 'guard' | 'pa_guard', targetId: string) => void

  // Celebration modals
  dismissDebtFreedom: () => void
  dismissDiscovery: () => void

  // Internal
  _setToast: (msg: string | null) => void
}

const VALID_MODES = new Set<GameModeId>(['commonwealth', 'capital_wasteland', 'mojave_wasteland'])

// Coerce missing or invalid fields for backward compatibility with old saves.
function normalizeState(state: GameState): GameState {
  const mode = VALID_MODES.has(state.mode) ? state.mode : 'commonwealth'
  const mc = GAME_MODES[mode]

  // Pre-overhaul saves stored guards/powerArmorGuards as plain counts. Migrate them to
  // full-HP unit arrays — legacy guards all become 'standard' class, the only one that existed.
  const legacyPlayer = state.player as unknown as { guards?: unknown; powerArmorGuards?: unknown; paGuards?: unknown; nextGuardId?: number }
  const guards: PlayerState['guards'] = Array.isArray(legacyPlayer.guards)
    ? (legacyPlayer.guards as PlayerState['guards'])
    : Array.from({ length: typeof legacyPlayer.guards === 'number' ? legacyPlayer.guards : 0 }, (_, i) => ({
        id: `guard_legacy_${i}`,
        classId: 'standard' as const,
        health: GUARD_CLASSES.standard.health,
        maxHealth: GUARD_CLASSES.standard.health,
        dead: false,
      }))
  const paGuards: PlayerState['paGuards'] = Array.isArray(legacyPlayer.paGuards)
    ? (legacyPlayer.paGuards as PlayerState['paGuards'])
    : Array.from({ length: typeof legacyPlayer.powerArmorGuards === 'number' ? legacyPlayer.powerArmorGuards : 0 }, (_, i) => ({
        id: `pa_guard_legacy_${i}`,
        health: mc.powerArmorGuardHealth,
        maxHealth: mc.powerArmorGuardHealth,
        dead: false,
      }))
  const nextGuardId = legacyPlayer.nextGuardId ?? (guards.length + paGuards.length)

  return {
    ...state,
    mode,
    gameType: state.gameType ?? 'standard',
    player: {
      ...state.player,
      guards,
      paGuards,
      nextGuardId,
      armor: state.player.armor ?? null,
      xp: state.player.xp ?? 0,
      visitedSettlements: state.player.visitedSettlements ?? [],
      tamingTool: state.player.tamingTool ?? null,
      hasSaddle: state.player.hasSaddle ?? false,
      mount: state.player.mount ?? null,
      conditions: state.player.conditions ?? [],
      gun: state.player.gun ? { ...state.player.gun, ammoPrice: state.player.gun.ammoPrice ?? 5 } : null,
      ownedGuns: (() => {
        const owned = state.player.ownedGuns ?? {}
        // Migrate saves that predate ownedGuns: if player has a gun, register it
        if (state.player.gun && !owned[state.player.gun.id]) {
          const gun = state.player.gun
          return { ...owned, [gun.id]: { ...gun, ammoPrice: gun.ammoPrice ?? 5 } }
        }
        return Object.fromEntries(
          Object.entries(owned).map(([id, g]) => [id, { ...g, ammoPrice: g.ammoPrice ?? 5 }])
        )
      })(),
    },
    combat: state.combat ? {
      ...state.combat,
      activeBuffs: state.combat.activeBuffs ?? [],
      chemUsedThisRound: state.combat.chemUsedThisRound ?? false,
    } : state.combat,
    pendingDebtFreedom: state.pendingDebtFreedom ?? null,
    pendingDiscovery: state.pendingDiscovery ?? null,
    stats: state.stats ? { ...initStats(), ...state.stats } : initStats(),
    earnedAchievements: state.earnedAchievements ?? [],
  }
}

function resolveEndStatus(state: GameState): 'won' | 'dead' | 'bankrupt' {
  if (!state.gameOverReason) return 'won'
  return resolveGameStatus(state.player, state.gameOverReason)
}

export const useGameStore = create<GameStore>((set, get) => {
  // --- Supabase sync (fire-and-forget, debounced) ---
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function syncToSupabase(state: GameState) {
    const { gameId } = get()
    if (!gameId) return

    const isGameOver = state.phase === 'game_over'
    const payload = {
      state,
      current_location: state.player.location,
      is_traveling: state.phase === 'traveling' || state.phase === 'event',
      mode: state.mode,
      game_type: state.gameType,
      ...(isGameOver
        ? {
            status:        resolveEndStatus(state),
            final_score:   state.gameType === 'free_play'
              ? (state.player.xp ?? 0)
              : calculateFinalScore(state.player, GAME_MODES[state.mode]),
            turns_reached: state.world.turn,
          }
        : {}),
    }

    set({ isSaving: true, saveError: null })
    const { error } = await supabase.from('games').update(payload).eq('id', gameId)
    if (error) {
      set({ saveError: 'Auto-save failed.', isSaving: false })
    } else {
      set({ isSaving: false })
    }
  }

  function scheduleSave(state: GameState) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => syncToSupabase(state), 400)
  }

  // --- Mutation helper ---
  function mutate(updater: (state: GameState) => GameState): GameState | null {
    const current = get().gameState
    if (!current) return null
    let next = updater(current)

    // Check for newly earned achievements
    const mc = GAME_MODES[next.mode]
    const newlyEarned = checkNewAchievements(current, next, mc)
    if (newlyEarned.length > 0) {
      const xpBonus = newlyEarned.reduce((sum, a) => sum + a.xpReward, 0)
      next = {
        ...next,
        player: { ...next.player, xp: next.player.xp + xpBonus },
        stats: addXpToStats(next.stats, xpBonus, 'achievements'),
        earnedAchievements: [
          ...next.earnedAchievements,
          ...newlyEarned.map(a => ({ id: a.id, earnedOnTurn: next.world.turn })),
        ],
      }
      setTimeout(() => {
        for (const a of newlyEarned) {
          gameBus.emit('ACHIEVEMENT_UNLOCKED', { achievementId: a.id, xpAwarded: a.xpReward })
        }
      }, 0)
    }

    set({ gameState: next })
    scheduleSave(next)
    // Auto-emit turn completion whenever a mutation increments the turn counter
    if (next.world.turn > current.world.turn) {
      gameBus.emit('TURN_COMPLETED', { turn: next.world.turn, inDebt: next.player.debt > 0 })
    }
    return next
  }

  // Helper: award a profit achievement outside of mutate() (per-trade event-driven)
  function awardProfitAchievement(id: string) {
    const state = get().gameState
    if (!state) return
    if (state.earnedAchievements.some(a => a.id === id)) return
    const def = ACHIEVEMENT_MAP[id]
    if (!def) return
    const xpAwarded = def.xpReward
    const earned = { id, earnedOnTurn: state.world.turn }
    const updated = {
      ...state,
      player: { ...state.player, xp: state.player.xp + xpAwarded },
      stats: addXpToStats(state.stats, xpAwarded, 'achievements'),
      earnedAchievements: [...state.earnedAchievements, earned],
    }
    set({ gameState: updated })
    scheduleSave(updated)
    gameBus.emit('ACHIEVEMENT_UNLOCKED', { achievementId: id, xpAwarded })
  }

  // --- Stats event subscribers --- (registered once for the store's lifetime)
  gameBus.on('COMBAT_RESOLVED', payload => {
    mutate(s => ({ ...s, stats: updateStats(s.stats, { type: 'COMBAT_RESOLVED', ...payload }) }))
  })
  gameBus.on('CHEM_SOLD', payload => {
    mutate(s => ({ ...s, stats: updateStats(s.stats, { type: 'CHEM_SOLD', ...payload }) }))
    // Per-trade profit achievements (need revenue/profit from the event payload)
    const state = get().gameState
    if (state) {
      const alreadyEarned = new Set(state.earnedAchievements.map(a => a.id))
      const triggered = checkProfitAchievements(payload.revenue, payload.profit, alreadyEarned)
      for (const id of triggered) awardProfitAchievement(id)
    }
  })
  gameBus.on('CHEM_BOUGHT', payload => {
    mutate(s => ({ ...s, stats: updateStats(s.stats, { type: 'CHEM_BOUGHT', ...payload }) }))
  })
  gameBus.on('TAME_COMPLETED', payload => {
    mutate(s => ({ ...s, stats: updateStats(s.stats, { type: 'TAME_COMPLETED', ...payload }) }))
  })
  gameBus.on('TURN_COMPLETED', payload => {
    mutate(s => ({ ...s, stats: updateStats(s.stats, { type: 'TURN_COMPLETED', ...payload }) }))
  })

  // --- Current market for the player's location, with active events applied ---
  function currentMarket(state: GameState): SettlementMarket {
    const raw = state.world.settlements[state.player.location]
    return applyMarketEvents(raw, state.world.activeMarketEvents, state.player.location)
  }

  return {
    gameId: null,
    gameState: null,
    activeGameSummaries: null,
    freePlaySummaries: { commonwealth: null, capital_wasteland: null, mojave_wasteland: null },
    isSaving: false,
    saveError: null,
    toast: null,
    combatAnimSteps: null,
    pendingFightResult: null,
    showTamingMinigame: false,

    startNewGame: async (characterName, userId, modeId = 'commonwealth', gameType = 'standard') => {
      if (gameType === 'free_play') {
        // Archive existing free play game for this mode only
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('game_type', 'free_play')
          .eq('mode', modeId)

        if (existing && existing.length > 0) {
          await supabase.from('games').update({ status: 'bankrupt' }).in('id', existing.map(r => r.id))
        }
      } else {
        // Archive the existing active standard game for this mode only
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('mode', modeId)
          .eq('game_type', 'standard')

        if (existing && existing.length > 0) {
          await supabase.from('games').update({ status: 'bankrupt' }).in('id', existing.map(r => r.id))
        }
      }

      const newState = initializeGame(characterName, modeId, gameType)

      const { data, error } = await supabase
        .from('games')
        .insert({
          user_id: userId,
          character_name: characterName,
          state: newState,
          status: 'active',
          mode: modeId,
          game_type: gameType,
          game_version: CURRENT_GAME_VERSION,
          current_location: newState.player.location,
          is_traveling: false,
        })
        .select('id')
        .single()

      if (error || !data) {
        set({ saveError: 'Failed to create game.' })
        return
      }

      set({ gameId: data.id, gameState: newState })
    },

    loadActiveGame: async (userId, modeId) => {
      let query = supabase
        .from('games')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (modeId) query = query.eq('mode', modeId)

      const { data, error } = await query.single()

      if (error || !data) {
        set({ gameId: null, gameState: null })
        return
      }

      const row = data as GameRow
      set({ gameId: row.id, gameState: normalizeState(row.state) })
    },

    loadActiveGames: async (userId) => {
      const { data, error } = await supabase
        .from('games')
        .select('id, character_name, state, mode, game_type')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error || !data) {
        set({ activeGameSummaries: { commonwealth: null, capital_wasteland: null, mojave_wasteland: null }, freePlaySummaries: { commonwealth: null, capital_wasteland: null, mojave_wasteland: null } })
        return
      }

      const summaries: Record<GameModeId, ActiveGameSummary | null> = {
        commonwealth: null,
        capital_wasteland: null,
        mojave_wasteland: null,
      }
      const freePlaySummaries: Record<GameModeId, ActiveGameSummary | null> = {
        commonwealth: null, capital_wasteland: null, mojave_wasteland: null,
      }

      for (const row of data as GameRow[]) {
        const modeId = (row.mode ?? row.state?.mode) as GameModeId | undefined
        if (!modeId) continue
        const summary: ActiveGameSummary = {
          id: row.id,
          characterName: row.character_name,
          turn: row.state?.world?.turn ?? 0,
          modeId,
        }
        if ((row.game_type ?? 'standard') === 'free_play') {
          if (!freePlaySummaries[modeId]) freePlaySummaries[modeId] = summary
        } else {
          if (!summaries[modeId]) summaries[modeId] = summary
        }
      }

      set({ activeGameSummaries: summaries, freePlaySummaries })
    },

    loadGameById: async (gameId) => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (error || !data) {
        set({ gameId: null, gameState: null })
        return
      }

      const row = data as GameRow
      set({ gameId: row.id, gameState: normalizeState(row.state) })
    },

    clearGame: () => set({ gameId: null, gameState: null }),

    travelTo: (destinationId) => {
      mutate(state => startTravel(state, destinationId))
    },

    continueTravel: () => {
      mutate(state => continueTravel(state))
    },

    resolveEvent: (choice) => {
      mutate(state => {
        const event = state.pendingEvent
        if (!event) return state

        switch (event.type) {
          case 'raider_ambush': {
            if (choice === 'fight') return startCombat(state)
            // Run before combat: roll escape chance
            const payload = (event.payload ?? {}) as {
              nextWaveNumber?: number
              forfeitCaps?: number
              forfeitChems?: Record<string, number>
            }
            const aliveGuardCount = state.player.guards.filter(g => !g.dead).length
            const runChance = Math.min(0.9, Math.max(0.1,
              0.40 + aliveGuardCount * 0.10 - state.player.brahmin * 0.05
            ))
            const dest = state.pendingDestination ?? state.player.location
            if (rng() < runChance) {
              let escapedPlayer = state.player
              const extraLogs: { turn: number; message: string; type: 'profit' | 'danger' }[] = []
              if ((payload.nextWaveNumber ?? 1) > 1) {
                const forfeitCaps  = payload.forfeitCaps  ?? 0
                const forfeitChems = payload.forfeitChems ?? {}
                if (forfeitCaps > 0 || Object.keys(forfeitChems).length > 0) {
                  const newInventory = { ...escapedPlayer.inventory }
                  for (const [chemId, qty] of Object.entries(forfeitChems)) {
                    if (newInventory[chemId]) {
                      const newQty = Math.max(0, newInventory[chemId].quantity - qty)
                      if (newQty === 0) delete newInventory[chemId]
                      else newInventory[chemId] = { ...newInventory[chemId], quantity: newQty }
                    }
                  }
                  escapedPlayer = { ...escapedPlayer, caps: Math.max(0, escapedPlayer.caps - forfeitCaps), inventory: newInventory }
                  const chemCount = Object.values(forfeitChems).reduce((s, n) => s + n, 0)
                  const forfeitDesc = [
                    forfeitCaps > 0 ? `${forfeitCaps} ¤` : '',
                    chemCount > 0 ? `${chemCount} chem${chemCount > 1 ? 's' : ''}` : '',
                  ].filter(Boolean).join(' and ')
                  extraLogs.push({ turn: state.world.turn, message: `No time to loot — you fled leaving ${forfeitDesc} behind.`, type: 'danger' })
                }
              }
              const escapeLogs = [...state.log, { turn: state.world.turn, message: "You dodge the ambush and keep moving!", type: 'profit' as const }, ...extraLogs]
              return completeTravel({ ...state, player: escapedPlayer, log: escapeLogs, pendingEvent: null, pendingDestination: null }, dest)
            } else {
              const caughtState = {
                ...state,
                player: { ...state.player, health: Math.max(1, state.player.health - 15) },
                log: [...state.log, { turn: state.world.turn, message: "You try to run but they cut you off! (-15 HP)", type: 'danger' as const }],
              }
              return startCombat(caughtState)
            }
          }

          case 'chem_stash':
            return resolveChemStash(state)

          case 'brotherhood_checkpoint':
            if (choice === 'fight') return startCombat(state)
            return resolveBrotherhoodToll(state, choice === 'pay')

          case 'debt_collector':
            return resolveDebtCollector(state)

          case 'brahmin_lost': {
            const { player, dropped } = loseBrahmin(state.player)
            const dest = state.pendingDestination ?? state.player.location
            const droppedDesc = Object.entries(dropped).map(([id, q]) => `${q}× ${id}`).join(', ')
            const msg = droppedDesc
              ? `One of your brahmin bolted into the wastes. Lost: ${droppedDesc} (pack over capacity).`
              : 'One of your brahmin bolted into the wastes. Inventory space reduced.'
            const log = [...state.log, { turn: state.world.turn, message: msg, type: 'danger' as const }]
            return completeTravel({ ...state, player, log, pendingEvent: null, pendingDestination: null }, dest)
          }

          case 'wandering_merchant': {
            const dest = state.pendingDestination ?? state.player.location
            return completeTravel({ ...state, pendingEvent: null, pendingDestination: null }, dest)
          }

          default:
            return state
        }
      })
    },

    resolveChemStashSwap: (dropped, taken) => {
      mutate(state => {
        if (!state.pendingEvent || state.pendingEvent.type !== 'chem_stash') return state
        const dest = state.pendingDestination ?? state.player.location
        let player = { ...state.player }

        // Apply drops
        const inventory = { ...player.inventory }
        for (const [chemId, qty] of Object.entries(dropped)) {
          const existing = inventory[chemId]
          if (!existing) continue
          const newQty = existing.quantity - qty
          if (newQty <= 0) delete inventory[chemId]
          else inventory[chemId] = { ...existing, quantity: newQty }
        }
        player = { ...player, inventory }

        // Apply takes
        for (const [chemId, qty] of Object.entries(taken)) {
          if (qty <= 0) continue
          const existing = player.inventory[chemId]
          player = {
            ...player,
            inventory: {
              ...player.inventory,
              [chemId]: { quantity: (existing?.quantity ?? 0) + qty, pricePaid: existing?.pricePaid ?? 0 },
            },
          }
        }

        const takenDesc = Object.entries(taken).filter(([, q]) => q > 0).map(([id, q]) => `${q}× ${id}`).join(', ')
        const log = [...state.log, { turn: state.world.turn, message: `Swapped pack contents. Took ${takenDesc}.`, type: 'profit' as const }]
        return completeTravel({ ...state, player, log, pendingEvent: null, pendingDestination: null }, dest)
      })
    },

    fight: () => {
      const state = get().gameState
      if (!state?.combat) return
      const mc = GAME_MODES[state.mode]
      const weaponId = state.player.gun?.id ?? null
      const playerFiredWeapon = weaponId !== null && (state.player.gun?.ammo ?? 0) > 0
      const { player, combat, animSteps } = resolveFight(state.player, state.combat, mc)
      if (animSteps.length === 0) {
        // No animation — emit event and apply immediately
        if (combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost') {
          gameBus.emit('COMBAT_RESOLVED', {
            outcome: combat.phase,
            killedEnemies: combat.enemies.filter(e => e.dead).map(e => ({ typeId: e.typeId })),
            weaponId,
            damageDealt: combat.totalDamageDealt,
            damageTaken: combat.totalDamageTaken,
            capsLooted: combat.capsLooted,
            waveNumber: state.combat.waveNumber,
            isCheckpointFight: state.combat.isCheckpointFight,
            playerFiredWeapon,
          })
        }
        mutate(s => afterCombat(s, { player, combat }))
      } else {
        set({ pendingFightResult: { player, combat }, combatAnimSteps: animSteps })
        mutate(s => s.combat ? { ...s, combat: { ...s.combat, phase: 'resolving' } } : s)
      }
    },

    completeCombatAnim: () => {
      const { pendingFightResult, gameState } = get()
      if (!pendingFightResult) return
      const { combat } = pendingFightResult
      // Emit only when combat resolved (not a failed flee that returns to player_choice)
      if (combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost') {
        gameBus.emit('COMBAT_RESOLVED', {
          outcome: combat.phase,
          killedEnemies: combat.enemies.filter(e => e.dead).map(e => ({ typeId: e.typeId })),
          weaponId: gameState?.player.gun?.id ?? null,
          damageDealt: combat.totalDamageDealt,
          damageTaken: combat.totalDamageTaken,
          capsLooted: combat.capsLooted,
          waveNumber: combat.waveNumber,
          isCheckpointFight: combat.isCheckpointFight,
          playerFiredWeapon: gameState?.player.gun !== null && (gameState?.player.gun?.ammo ?? 0) > 0,
        })
      }
      set({ combatAnimSteps: null, pendingFightResult: null })
      mutate(s => afterCombat(s, pendingFightResult))
    },

    run: () => {
      const state = get().gameState
      if (!state?.combat) return
      const mc = GAME_MODES[state.mode]
      const weaponId = state.player.gun?.id ?? null
      const playerFiredWeapon = weaponId !== null && (state.player.gun?.ammo ?? 0) > 0
      const { player, combat, animSteps } = resolveRun(state.player, state.combat, mc)
      if (animSteps.length > 0) {
        // Flee failed — animate enemy retaliation before applying result
        set({ pendingFightResult: { player, combat }, combatAnimSteps: animSteps })
        mutate(s => s.combat ? { ...s, combat: { ...s.combat, phase: 'resolving' } } : s)
      } else {
        // Flee succeeded — emit and apply immediately
        gameBus.emit('COMBAT_RESOLVED', {
          outcome: 'fled',
          killedEnemies: [],
          weaponId,
          damageDealt: combat.totalDamageDealt,
          damageTaken: combat.totalDamageTaken,
          capsLooted: 0,
          waveNumber: state.combat.waveNumber,
          isCheckpointFight: state.combat.isCheckpointFight,
          playerFiredWeapon,
        })
        mutate(s => afterCombat(s, { player, combat }))
      }
    },

    dismissCombatSummary: () => {
      mutate(state => dismissCombatSummary(state))
    },

    openTamingMinigame: () => {
      const state = get().gameState
      if (!state?.combat) return
      if (!canAttemptTame(state.player, state.combat)) return
      set({ showTamingMinigame: true })
    },

    completeTame: () => {
      const state = get().gameState
      if (!state?.combat) return
      set({ showTamingMinigame: false })
      const { player, combat } = resolveTameSuccess(state.player, state.combat)
      const tamedEnemyTypeId = state.combat.enemies[0]?.typeId ?? ''
      set({ pendingFightResult: { player, combat } })
      gameBus.emit('COMBAT_RESOLVED', {
        outcome: 'won',
        killedEnemies: [],  // tamed, not killed
        weaponId: state.player.gun?.id ?? null,
        damageDealt: combat.totalDamageDealt,
        damageTaken: combat.totalDamageTaken,
        capsLooted: combat.capsLooted,
        waveNumber: state.combat.waveNumber,
        isCheckpointFight: state.combat.isCheckpointFight,
        playerFiredWeapon: false,  // taming never involves firing a weapon
      })
      if (tamedEnemyTypeId) {
        gameBus.emit('TAME_COMPLETED', { enemyTypeId: tamedEnemyTypeId })
      }
      mutate(s => afterCombat(s, { player, combat }))
    },

    abandonTame: () => {
      const state = get().gameState
      if (!state?.combat) return
      set({ showTamingMinigame: false })
      const mc = GAME_MODES[state.mode]
      const { player, combat, animStep } = resolveFailedTame(state.player, state.combat, mc)
      set({ pendingFightResult: { player, combat }, combatAnimSteps: [animStep] })
      mutate(s => s.combat ? { ...s, combat: { ...s.combat, phase: 'resolving' } } : s)
    },

    purchaseTamingTool: (toolId) => {
      mutate(state => {
        const toolDef = TAMING_TOOLS[toolId]
        if (!toolDef) return state
        const { player, error } = buyTamingTool(state.player, toolDef)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Equipped ${toolDef.name}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseSaddle: () => {
      mutate(state => {
        const { player, error } = buySaddle(state.player, SADDLE_PRICE)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Purchased leather saddle (${SADDLE_PRICE} ¤).`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    healMount: () => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const settlement = mc.settlements[state.player.location]
        if (!settlement.hasDoctor) return state
        const mountHealCost = settlement.doctorCost * 2
        const { player, error } = healMountFn(state.player, mountHealCost)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Mount healed for ${mountHealCost} ¤.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    buy: (chemId, quantity) => {
      const purchase = { pricePaid: 0, ok: false }
      mutate(state => {
        const market = currentMarket(state)
        const { player, error } = buyChems(state.player, market, chemId, quantity)
        if (error) { set({ toast: error }); return state }
        purchase.pricePaid = market.prices[chemId]
        purchase.ok = true
        const loc = state.player.location
        const world = updateSettlementStock(state.world, loc, chemId, -quantity)
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Bought ${quantity} ${chemId} for ${market.prices[chemId] * quantity} caps.`,
          type: 'info' as const,
        }]
        return { ...state, player, world, log }
      })
      if (purchase.ok) {
        gameBus.emit('CHEM_BOUGHT', { chemId, quantity, pricePaid: purchase.pricePaid })
      }
    },

    sell: (chemId, quantity) => {
      // Use an object so TypeScript doesn't narrow away the assignment inside the closure
      const sale = { revenue: 0, profit: 0, ok: false }
      mutate(state => {
        const market = currentMarket(state)
        const { player: sold, profit, error } = sellChems(state.player, market, chemId, quantity)
        if (error) { set({ toast: error }); return state }
        let player = sold
        const revenue = market.prices[chemId] * quantity
        sale.revenue = revenue
        sale.profit = profit
        sale.ok = true
        const loc = state.player.location
        const world = updateSettlementStock(state.world, loc, chemId, +quantity)
        const profitMsg = profit >= 0 ? `(+${profit} profit)` : `(${profit} loss)`
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Sold ${quantity} ${chemId} for ${revenue} caps. ${profitMsg}`,
          type: profit >= 0 ? 'profit' as const : 'danger' as const,
        }]
        let tradeStats = state.stats
        if (profit > 0) {
          const { player: px, stats: sx, logMessage: xpMsg } = awardXp(player, state.stats, { type: XpEventType.TradeProfit, profit })
          player = px
          tradeStats = sx
          if (xpMsg) log.push({ turn: state.world.turn, message: xpMsg, type: 'profit' as const })
        }
        return { ...state, player, world, stats: tradeStats, log }
      })
      if (sale.ok) {
        gameBus.emit('CHEM_SOLD', { chemId, quantity, revenue: sale.revenue, profit: sale.profit, channel: 'market' })
      }
    },

    buyFromMerchant: (chemId, quantity) => {
      const purchase = { pricePaid: 0, ok: false }
      mutate(state => {
        if (!state.pendingEvent || state.pendingEvent.type !== 'wandering_merchant') return state
        const payload = state.pendingEvent.payload as { prices: Record<string,number>; stock: Record<string,number> }
        const price = payload.prices[chemId]
        const inStock = payload.stock[chemId] ?? 0
        if (!price || inStock < quantity) { set({ toast: 'Not enough stock.' }); return state }
        purchase.pricePaid = price
        purchase.ok = true
        const syntheticMarket = { prices: payload.prices, stock: payload.stock, lastRefreshed: 0 }
        const { player, error } = buyChems(state.player, syntheticMarket, chemId, quantity)
        if (error) { set({ toast: error }); return state }
        const newPayload = { ...payload, stock: { ...payload.stock, [chemId]: inStock - quantity } }
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Bought ${quantity} ${chemId} from fence for ${price * quantity} caps.`,
          type: 'info' as const,
        }]
        return { ...state, player, pendingEvent: { ...state.pendingEvent, payload: newPayload }, log }
      })
      if (purchase.ok) {
        gameBus.emit('CHEM_BOUGHT', { chemId, quantity, pricePaid: purchase.pricePaid })
      }
    },

    sellToMerchant: (chemId, quantity) => {
      const sale = { revenue: 0, profit: 0, ok: false, isDesperateBuyer: false }
      mutate(state => {
        if (!state.pendingEvent || state.pendingEvent.type !== 'wandering_merchant') return state
        const payload = state.pendingEvent.payload as { prices: Record<string,number>; demand: Record<string,number>; isFence?: boolean }
        sale.isDesperateBuyer = payload.isFence === false
        const price = payload.prices[chemId]
        const remaining = payload.demand[chemId] ?? 0
        if (!price || remaining < quantity) { set({ toast: "They don't want that many." }); return state }
        const existing = state.player.inventory[chemId]
        if (!existing || existing.quantity < quantity) { set({ toast: 'Not enough in inventory.' }); return state }
        const revenue = price * quantity
        const profit  = revenue - existing.pricePaid * quantity
        sale.revenue = revenue
        sale.profit = profit
        sale.ok = true
        const newQty  = existing.quantity - quantity
        const inventory = { ...state.player.inventory }
        if (newQty === 0) delete inventory[chemId]
        else inventory[chemId] = { ...existing, quantity: newQty }
        let player = { ...state.player, caps: state.player.caps + revenue, inventory }
        const newPayload = { ...payload, demand: { ...payload.demand, [chemId]: remaining - quantity } }
        const profitMsg = profit >= 0 ? `(+${profit} profit)` : `(${profit} loss)`
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Sold ${quantity} ${chemId} to buyer for ${revenue} caps. ${profitMsg}`,
          type: profit >= 0 ? 'profit' as const : 'danger' as const,
        }]
        let merchantStats = state.stats
        if (profit > 0) {
          const { player: px, stats: sx, logMessage: xpMsg } = awardXp(player, state.stats, { type: XpEventType.TradeProfit, profit })
          player = px
          merchantStats = sx
          if (xpMsg) log.push({ turn: state.world.turn, message: xpMsg, type: 'profit' as const })
        }
        return { ...state, player, stats: merchantStats, pendingEvent: { ...state.pendingEvent, payload: newPayload }, log }
      })
      if (sale.ok) {
        const channel = sale.isDesperateBuyer ? 'desperate_buyer' : 'merchant'
        gameBus.emit('CHEM_SOLD', { chemId, quantity, revenue: sale.revenue, profit: sale.profit, channel })
      }
    },

    heal: () => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const settlement = mc.settlements[state.player.location]
        if (!settlement.hasDoctor) return state
        const { player, error } = healPlayer(state.player, settlement.doctorCost)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Fully healed at the doctor for ${settlement.doctorCost} caps.`,
          type: 'info' as const,
        }]
        return { ...state, player, log }
      })
    },

    buyAntivenom: () => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const settlement = mc.settlements[state.player.location]
        if (!settlement.hasDoctor) { set({ toast: 'No doctor here.' }); return state }
        const ANTIVENOM_PRICE = 200
        if (state.player.caps < ANTIVENOM_PRICE) { set({ toast: 'Not enough caps.' }); return state }
        const existing = state.player.inventory['antivenom']
        const inventory = {
          ...state.player.inventory,
          antivenom: { quantity: (existing?.quantity ?? 0) + 1, pricePaid: ANTIVENOM_PRICE },
        }
        const player = { ...state.player, caps: state.player.caps - ANTIVENOM_PRICE, inventory }
        const log = [...state.log, { turn: state.world.turn, message: `Bought antivenom for ${ANTIVENOM_PRICE} caps.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    useAntivenom: () => {
      mutate(state => {
        const existing = state.player.inventory['antivenom']
        if (!existing || existing.quantity < 1) { set({ toast: 'No antivenom in inventory.' }); return state }
        const newQty = existing.quantity - 1
        const inventory = { ...state.player.inventory }
        if (newQty === 0) delete inventory['antivenom']
        else inventory['antivenom'] = { ...existing, quantity: newQty }
        const conditions = (state.player.conditions ?? []).filter(c => c.type !== 'radscorpion_venom' && c.type !== 'cazador_venom')
        const player = { ...state.player, inventory, conditions }
        const combat = state.combat ? { ...state.combat, playerVenomed: false } : state.combat
        const log = [...state.log, { turn: state.world.turn, message: 'Antivenom administered. Venom cleared.', type: 'info' as const }]
        return { ...state, player, combat, log }
      })
    },

    useStimpakInCombat: (targetKind, targetId) => {
      mutate(state => {
        const { state: next, error } = applyCombatChem(state, 'stimpak', targetKind, targetId)
        if (error) { set({ toast: error }); return state }
        return next
      })
    },

    useJetInCombat: (targetKind, targetId) => {
      mutate(state => {
        const { state: next, error } = applyCombatChem(state, 'jet', targetKind, targetId)
        if (error) { set({ toast: error }); return state }
        return next
      })
    },

    useUltrajetInCombat: (targetKind, targetId) => {
      mutate(state => {
        const { state: next, error } = applyCombatChem(state, 'ultrajet', targetKind, targetId)
        if (error) { set({ toast: error }); return state }
        return next
      })
    },

    borrow: (amount) => {
      mutate(state => {
        const player = takeLoan(state.player, amount)
        const log = [...state.log, { turn: state.world.turn, message: `Borrowed ${amount} caps. Total debt: ${player.debt}.`, type: 'danger' as const }]
        return { ...state, player, log }
      })
    },

    payDebt: (amount) => {
      mutate(state => {
        const { player: paid, error } = repayDebt(state.player, amount)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Paid ${amount} caps toward debt. Remaining: ${paid.debt}.`, type: 'profit' as const }]
        const debtCleared = paid.debt === 0 && !state.player.debtEverCleared
        let player = debtCleared ? { ...paid, debtEverCleared: true } : paid
        let pendingDebtFreedom: number | null = null
        if (debtCleared) {
          // XP is awarded via the pay_off_debt achievement (fires in checkNewAchievements)
          pendingDebtFreedom = ACHIEVEMENT_MAP['pay_off_debt']?.xpReward ?? 500
        }
        return { ...state, player, log, pendingDebtFreedom }
      })
    },

    hireguards: (classId, count) => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const { player, error } = hireGuards(state.player, classId, count, mc.maxGuards)
        if (error) { set({ toast: error }); return state }
        const className = GUARD_CLASSES[classId].name
        const log = [...state.log, { turn: state.world.turn, message: `Hired ${count} ${className} guard${count > 1 ? 's' : ''}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchasePowerArmorGuard: (count) => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const { player, error } = buyPowerArmorGuard(state.player, count, mc.powerArmorGuardCost, mc.powerArmorGuardHealth, mc.maxPowerArmorGuards)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Fitted ${count} guard${count > 1 ? 's' : ''} with power armor.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseBrahmin: (count) => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const { player, error } = buyBrahmin(state.player, count, mc.brahminCost, mc.maxBrahmin)
        if (error) { set({ toast: error }); return state }
        const capacity = mc.baseCapacity + player.brahmin * mc.capacityPerBrahmin
        const log = [...state.log, { turn: state.world.turn, message: `Bought ${count} brahmin. Capacity now ${capacity}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseGun: (gunId) => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const gunDef = mc.guns[gunId]
        if (!gunDef) return state
        const { player, error } = buyGun(state.player, gunDef)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Purchased ${gunDef.name} with ${gunDef.ammoWithPurchase} rounds.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    equipGun: (gunId) => {
      mutate(state => {
        const { player, error } = equipGunFn(state.player, gunId)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Equipped ${player.gun!.name}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseAmmo: (rounds) => {
      mutate(state => {
        const { player, error } = buyAmmo(state.player, rounds)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Bought ${rounds} rounds.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseAmmoForGun: (gunId, rounds) => {
      mutate(state => {
        const isEquipped = state.player.gun?.id === gunId
        const gunState   = isEquipped ? state.player.gun! : state.player.ownedGuns?.[gunId]
        if (!gunState) return state
        const cost = rounds * gunState.ammoPrice
        if (state.player.caps < cost) { set({ toast: 'Not enough caps.' }); return state }
        const updatedGun = { ...gunState, ammo: gunState.ammo + rounds }
        const ownedGuns  = { ...state.player.ownedGuns, [gunId]: updatedGun }
        const player = {
          ...state.player,
          caps:      state.player.caps - cost,
          ownedGuns,
          gun: isEquipped ? updatedGun : state.player.gun,
        }
        const log = [...state.log, { turn: state.world.turn, message: `Bought ${rounds} rounds for ${gunState.name}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseArmor: (armorId) => {
      mutate(state => {
        const mc = GAME_MODES[state.mode]
        const armorDef = mc.armors[armorId]
        if (!armorDef) return state
        const { player, error } = buyArmor(state.player, armorDef)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Purchased ${armorDef.name}. (${armorDef.armorPoints} AP)`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    repairArmor: () => {
      mutate(state => {
        const { player, error } = repairArmor(state.player)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Armor repaired to full condition.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    retire: () => {
      mutate(state => retireGameFn(state))
    },

    dismissDebtFreedom: () => {
      mutate(state => ({ ...state, pendingDebtFreedom: null }))
    },

    dismissDiscovery: () => {
      mutate(state => ({ ...state, pendingDiscovery: null }))
    },

    _setToast: (msg) => set({ toast: msg }),
  }
})
