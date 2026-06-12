export type GameModeId = 'commonwealth' | 'capital_wasteland' | 'mojave_wasteland'

export interface EnemyType {
  id: string
  name: string
  caps: [number, number]     // [min, max] caps carried
  lootChems: string[]        // possible drops on victory
  eventOnly?: boolean        // if true, never spawns in random road encounters
}

export interface EnemyUnit {
  id: string                 // "enemy_0", "enemy_1" …
  typeId: string             // references EnemyType.id
  name: string               // "Raider 1", "Super Mutant Brute" …
  health: number
  maxHealth: number
  dead: boolean
}

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
  debt: number
  health: number
  maxHealth: number
  guards: number
  brahmin: number
  location: string   // settlement id
  ageOfDebt: number  // turns elapsed since debt was first taken
  inventory: Record<string, InventoryEntry>
  gun: GunState | null
  debtPaidThisCycle?: number    // caps paid toward debt since last turn tick; resets each tick
  debtWarnings?: number         // times enforcement has triggered; drives damage escalation
  debtWindowCapsPaid?: number   // cumulative caps paid in the current payment window
  debtWindowStartAge?: number   // ageOfDebt when the current payment window opened
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
  enemies: EnemyUnit[]
  capsPool: number                      // total caps all enemies carry
  totalDamageDealt: number
  totalDamageTaken: number
  enemyLoot: Record<string, number>     // chems found on enemies (awarded on victory)
  capsLooted: number
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
  mode: GameModeId
  player: PlayerState
  world: WorldState
  phase: GamePhase
  pendingEvent: TravelEvent | null
  pendingDestination: string | null  // where we're heading during travel/event phase
  pendingQuote: TransitQuote | null  // shown on the transit splash while phase === 'traveling'
  combat: CombatState | null
  gameOverReason: GameOverReason | null
  endReason: string | null    // human-readable end reason for death screen + leaderboard
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
  mode: GameModeId | null        // null for pre-v2 rows (migration 003)
  turns_reached: number | null   // set on game over
  created_at: string
  updated_at: string
}

// Summary shape used in Home screen save slots
export interface ActiveGameSummary {
  id: string
  characterName: string
  turn: number
  modeId: GameModeId
}
