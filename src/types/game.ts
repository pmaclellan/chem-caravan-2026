export interface GunState {
  id: string
  name: string
  accuracy: number
  damage: number
  ammo: number
  ammoPerShot: number
}

export interface InventoryEntry {
  quantity: number
  pricePaid: number  // weighted average cost basis, for P&L display
}

export interface PlayerState {
  name: string
  caps: number
  bank: number
  debt: number
  health: number
  maxHealth: number
  guards: number
  brahmin: number
  location: string   // settlement id
  ageOfDebt: number  // turns elapsed since debt was first taken
  inventory: Record<string, InventoryEntry>
  gun: GunState | null
}

export interface SettlementMarket {
  prices: Record<string, number>  // chemId -> current price
  stock: Record<string, number>   // chemId -> units available this turn
  lastRefreshed: number           // turn number
}

export type MarketEventType = 'shortage' | 'surplus' | 'new_shipment'

export interface MarketEvent {
  id: string
  type: MarketEventType
  chemId: string
  settlementId: string | null   // null = all settlements affected
  multiplier: number
  turnsRemaining: number
  message: string
}

export interface CombatState {
  raiderCount: number
  raiderHealth: number   // total health pool across all raiders
  raiderCaps: number     // total caps on them
  raidersStartCount: number
  totalDamageDealt: number
  totalDamageTaken: number
  raiderChems: Record<string, number>  // chems found on raiders (awarded on victory)
  capsLooted: number                   // caps looted on victory (raiderCaps is zeroed after)
  phase: 'player_choice' | 'resolving' | 'won' | 'fled' | 'lost'
  log: string[]
}

export type LogType = 'info' | 'danger' | 'profit' | 'system'

export interface LogEntry {
  turn: number
  message: string
  type: LogType
}

export type TravelEventType =
  | 'raider_ambush'
  | 'chem_stash'
  | 'wandering_merchant'
  | 'brahmin_lost'
  | 'debt_collector'
  | 'brotherhood_checkpoint'

export interface TravelEvent {
  type: TravelEventType
  title: string
  description: string
  payload?: Record<string, unknown>  // event-specific data (e.g. found chems, toll amount)
}

export type GamePhase =
  | 'settlement'
  | 'traveling'
  | 'event'
  | 'combat'
  | 'combat_summary'
  | 'merchant'
  | 'game_over'

export type GameOverReason = 'turns' | 'debt' | 'combat' | 'bankrupt'

export interface WorldState {
  turn: number
  maxTurns: number
  settlements: Record<string, SettlementMarket>
  activeMarketEvents: MarketEvent[]
}

export interface TransitQuote {
  text: string
  speaker: string
}

export interface GameState {
  player: PlayerState
  world: WorldState
  phase: GamePhase
  pendingEvent: TravelEvent | null
  pendingDestination: string | null  // where we're heading during travel/event phase
  pendingQuote: TransitQuote | null  // shown on the transit splash while phase === 'traveling'
  combat: CombatState | null
  gameOverReason: GameOverReason | null
  log: LogEntry[]
}

// Shape of a row in the Supabase games table (subset of columns we care about client-side)
export interface GameRow {
  id: string
  user_id: string
  character_name: string
  state: GameState
  status: 'active' | 'won' | 'dead' | 'bankrupt'
  final_score: number | null
  current_location: string | null
  is_traveling: boolean
  created_at: string
  updated_at: string
}
