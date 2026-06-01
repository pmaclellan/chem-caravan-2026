import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { GameState, GameRow } from '../types/game'
import {
  initializeGame,
  startTravel,
  completeTravel,
  resolveChemStash,
  resolveBrotherhoodToll,
  resolveDebtCollector,
  startCombat,
  afterCombat,
} from '../engine/gameLoop'
import { resolveFight, resolveRun } from '../engine/combat'
import { rng } from '../engine/rng'
import {
  buyChems,
  sellChems,
  healPlayer,
  depositToBank,
  withdrawFromBank,
  takeLoan,
  repayDebt,
  hireGuards,
  buyBrahmin,
  buyGun,
  buyAmmo,
  calculateFinalScore,
  resolveGameStatus,
} from '../engine/economy'
import { GUNS } from '../data/guns'
import { SETTLEMENTS } from '../data/settlements'
import type { SettlementMarket } from '../types/game'

interface GameStore {
  gameId: string | null
  gameState: GameState | null
  isSaving: boolean
  saveError: string | null
  toast: string | null

  // Lifecycle
  startNewGame: (characterName: string, userId: string) => Promise<void>
  loadActiveGame: (userId: string) => Promise<void>
  clearGame: () => void

  // Travel
  travelTo: (destinationId: string) => void

  // Events
  resolveEvent: (choice: string) => void

  // Combat
  fight: () => void
  run: () => void

  // Market
  buy: (chemId: string, quantity: number) => void
  sell: (chemId: string, quantity: number) => void

  // Services
  heal: () => void
  deposit: (amount: number) => void
  withdraw: (amount: number) => void
  borrow: (amount: number) => void
  payDebt: (amount: number) => void
  hireguards: (count: number) => void
  purchaseBrahmin: (count: number) => void
  purchaseGun: (gunId: string) => void
  purchaseAmmo: (rounds: number) => void

  // Internal
  _setToast: (msg: string | null) => void
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
      ...(isGameOver
        ? {
            status: resolveEndStatus(state),
            final_score: calculateFinalScore(state.player),
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
  function mutate(updater: (state: GameState) => GameState) {
    const current = get().gameState
    if (!current) return
    const next = updater(current)
    set({ gameState: next })
    scheduleSave(next)
  }

  // --- Current market for the player's location ---
  function currentMarket(state: GameState): SettlementMarket {
    return state.world.settlements[state.player.location]
  }

  return {
    gameId: null,
    gameState: null,
    isSaving: false,
    saveError: null,
    toast: null,

    startNewGame: async (characterName, userId) => {
      // Archive any existing active game first
      await supabase
        .from('games')
        .update({ status: 'bankrupt' })
        .eq('user_id', userId)
        .eq('status', 'active')

      const newState = initializeGame(characterName)

      const { data, error } = await supabase
        .from('games')
        .insert({
          user_id: userId,
          character_name: characterName,
          state: newState,
          status: 'active',
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

    loadActiveGame: async (userId) => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        set({ gameId: null, gameState: null })
        return
      }

      const row = data as GameRow
      set({ gameId: row.id, gameState: row.state })
    },

    clearGame: () => set({ gameId: null, gameState: null }),

    travelTo: (destinationId) => {
      mutate(state => startTravel(state, destinationId))
    },

    resolveEvent: (choice) => {
      mutate(state => {
        const event = state.pendingEvent
        if (!event) return state

        switch (event.type) {
          case 'raider_ambush': {
            if (choice === 'fight') return startCombat(state)
            // Run before combat: roll escape chance
            const runChance = Math.min(0.9, Math.max(0.1,
              0.40 + state.player.guards * 0.10 - state.player.brahmin * 0.05
            ))
            const dest = state.pendingDestination ?? state.player.location
            if (rng() < runChance) {
              const escapeLogs = [...state.log, { turn: state.world.turn, message: "You dodge the ambush and keep moving!", type: 'profit' as const }]
              return completeTravel({ ...state, log: escapeLogs, pendingEvent: null, pendingDestination: null }, dest)
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
            return resolveBrotherhoodToll(state, choice === 'pay')

          case 'debt_collector':
            return resolveDebtCollector(state)

          case 'brahmin_lost': {
            // Handled directly in startCombat resolution; here just continue
            const dest = state.pendingDestination ?? state.player.location
            return completeTravel({ ...state, pendingEvent: null, pendingDestination: null }, dest)
          }

          case 'wandering_merchant':
            // Merchant trading handled via buy/sell — just dismiss for now
            return { ...state, phase: 'merchant' as const }

          default:
            return state
        }
      })
    },

    fight: () => {
      const state = get().gameState
      if (!state?.combat || !state.player.gun) return
      const result = resolveFight(state.player, state.combat)
      mutate(s => afterCombat(s, result))
    },

    run: () => {
      const state = get().gameState
      if (!state?.combat) return
      const result = resolveRun(state.player, state.combat)
      mutate(s => afterCombat(s, result))
    },

    buy: (chemId, quantity) => {
      mutate(state => {
        const market = currentMarket(state)
        const { player, error } = buyChems(state.player, market, chemId, quantity)
        if (error) {
          set({ toast: error })
          return state
        }
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Bought ${quantity} ${chemId} for ${market.prices[chemId] * quantity} caps.`,
          type: 'info' as const,
        }]
        return { ...state, player, log }
      })
    },

    sell: (chemId, quantity) => {
      mutate(state => {
        const market = currentMarket(state)
        const { player, profit, error } = sellChems(state.player, market, chemId, quantity)
        if (error) {
          set({ toast: error })
          return state
        }
        const profitMsg = profit >= 0 ? `(+${profit} profit)` : `(${profit} loss)`
        const log = [...state.log, {
          turn: state.world.turn,
          message: `Sold ${quantity} ${chemId} for ${market.prices[chemId] * quantity} caps. ${profitMsg}`,
          type: profit >= 0 ? 'profit' as const : 'danger' as const,
        }]
        return { ...state, player, log }
      })
    },

    heal: () => {
      mutate(state => {
        const settlement = SETTLEMENTS[state.player.location]
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

    deposit: (amount) => {
      mutate(state => {
        const { player, error } = depositToBank(state.player, amount)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Deposited ${amount} caps to bank.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    withdraw: (amount) => {
      mutate(state => {
        const { player, error } = withdrawFromBank(state.player, amount)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Withdrew ${amount} caps from bank.`, type: 'info' as const }]
        return { ...state, player, log }
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
        const { player, error } = repayDebt(state.player, amount)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Paid ${amount} caps toward debt. Remaining: ${player.debt}.`, type: 'profit' as const }]
        return { ...state, player, log }
      })
    },

    hireguards: (count) => {
      mutate(state => {
        const { player, error } = hireGuards(state.player, count)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Hired ${count} guard${count > 1 ? 's' : ''}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseBrahmin: (count) => {
      mutate(state => {
        const { player, error } = buyBrahmin(state.player, count)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Bought ${count} brahmin. Capacity now ${20 + player.brahmin * 10}.`, type: 'info' as const }]
        return { ...state, player, log }
      })
    },

    purchaseGun: (gunId) => {
      mutate(state => {
        const gunDef = GUNS[gunId]
        if (!gunDef) return state
        const { player, error } = buyGun(state.player, gunDef)
        if (error) { set({ toast: error }); return state }
        const log = [...state.log, { turn: state.world.turn, message: `Purchased ${gunDef.name} with 20 rounds.`, type: 'info' as const }]
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

    _setToast: (msg) => set({ toast: msg }),
  }
})
