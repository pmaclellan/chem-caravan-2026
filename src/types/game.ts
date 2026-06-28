export type GameModeId = 'commonwealth' | 'capital_wasteland' | 'mojave_wasteland'
export type GameType = 'standard' | 'free_play'

export interface EnemyType {
  id: string
  name: string
  caps: [number, number]     // [min, max] caps carried
  lootChems: string[]        // possible drops on victory
  eventOnly?: boolean        // if true, never spawns in random road encounters
  countMultiplier?: number   // scales danger-level-based spawn count (default 1)
}

export type TamingToolId = 'lasso' | 'tranq_gun' | 'mesmetron'

export interface TamingToolState {
  id: TamingToolId
  name: string
  greenWindowFraction: number
  cursorSpeedMultiplier: number
}

export interface MountState {
  creatureTypeId: string
  name: string
  health: number
  maxHealth: number
  damage: [number, number]
  accuracy: number
}

export interface ArmorDefinition {
  id: string
  name: string
  price: number
  armorPoints: number
  repairCostPerAP: number
  description: string
}

export interface ArmorState {
  id: string
  name: string
  armorPoints: number
  maxArmorPoints: number
  repairCostPerAP: number
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
  ammoPrice: number        // caps per round (gun-specific)
  shotsPerTurn?: number    // minigun: fires this many times per trigger pull
  cooldownTurns?: number   // turns of reload after firing (missile launcher)
  cooldownRemaining?: number
  splashRatios?: number[]  // on hit: damage fractions applied to subsequent alive enemies
  strayChance?: number     // on miss: chance a stray shot hits a random other alive enemy
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
  powerArmorGuards: number
  brahmin: number
  location: string   // settlement id
  ageOfDebt: number  // turns elapsed since debt was first taken
  inventory: Record<string, InventoryEntry>
  gun: GunState | null
  ownedGuns: Record<string, GunState>  // all purchased guns keyed by id; ammo persists when unequipped
  armor: ArmorState | null
  tamingTool: TamingToolState | null
  hasSaddle: boolean
  mount: MountState | null
  xp: number                    // accumulated XP across all activities
  visitedSettlements: string[]  // settlement ids visited this run (for discovery bonus)
  debtPaidThisCycle?: number    // caps paid toward debt since last turn tick; resets each tick
  debtBorrowedThisCycle?: number // caps borrowed since last turn tick; netted against paid for window credit
  debtWarnings?: number         // times enforcement has triggered; drives damage escalation
  debtWindowCapsPaid?: number   // cumulative caps paid in the current payment window
  debtWindowStartAge?: number   // ageOfDebt when the current payment window opened
  debtWindowMinPayment?: number // minimum payment required for the current window (fixed at window open)
  conditions?: PlayerCondition[]  // persistent status effects (e.g. radscorpion venom)
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

export type PlayerCondition = { type: 'radscorpion_venom' } | { type: 'cazador_venom' }

export interface CombatState {
  enemies: EnemyUnit[]
  capsPool: number                      // total caps all enemies carry
  totalDamageDealt: number
  totalDamageTaken: number
  enemyLoot: Record<string, number>     // chems found on enemies (awarded on victory)
  capsLooted: number
  xpGained: number                      // XP awarded on this combat's victory (for summary screen)
  phase: 'player_choice' | 'resolving' | 'won' | 'fled' | 'lost'
  log: string[]
  enragedEnemyIds?: string[]   // enemy ids that deal +20% damage next turn (set on failed tame)
  playerVenomed?: boolean      // cazador venom active: -30% accuracy, +5 HP DoT per round
}

export type AnimStep =
  | {
      kind: 'shot'
      by: 'player' | 'guard' | 'pa_guard'
      guardIdx: number          // -1 for player, 0-based index among all guards/PA guards
      hit: boolean
      damage: number
      targetId: string | null
      targetDied: boolean
      targetHealthAfter: number
      logLine: string
    }
  | {
      kind: 'mount_attack'
      hit: boolean
      damage: number
      targetId: string | null
      targetDied: boolean
      targetHealthAfter: number
      logLine: string
    }
  | {
      kind: 'retaliation'
      paGuardsLost: number
      guardsLost: number
      armorAbsorb: number
      hpDamage: number
      mountDamageTaken: number
      mountDied: boolean
      logLines: string[]
      venomApplied?: boolean
      venomDotDamage?: number
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

export type GameOverReason = 'turns' | 'debt' | 'combat' | 'bankrupt' | 'retired'

export interface WorldState {
  turn: number
  maxTurns: number | null  // null in free play (no turn limit)
  settlements: Record<string, SettlementMarket>
  activeMarketEvents: MarketEvent[]
}

export interface TransitQuote {
  text: string
  speaker: string
}

export interface GameState {
  mode: GameModeId
  gameType: GameType
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
  mode: GameModeId | null              // null for pre-v2 rows (migration 003)
  turns_reached: number | null         // set on game over
  game_type: GameType // defaults to 'standard' (migration 005)
  game_version: number | null  // semver encoded as major*10000+minor*100+patch; null = pre-versioning
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
