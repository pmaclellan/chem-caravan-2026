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

export type GuardClassId = 'standard' | 'shotgunner' | 'sniper' | 'medic'

export interface GuardUnit {
  id: string            // "guard_7" — assigned from PlayerState.nextGuardId at hire time
  classId: GuardClassId
  health: number
  maxHealth: number
  dead: boolean          // true once killed in combat; pruned on arrival at the next settlement
  cooldownRemaining?: number  // sniper only — rounds left before next shot; persists across waves/encounters like gun cooldown
}

export interface PAGuardUnit {
  id: string             // "pa_guard_3" — same id counter as GuardUnit, no classId (PA stays unclassed)
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
  requiresPowerArmor?: boolean
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
  guards: GuardUnit[]
  paGuards: PAGuardUnit[]
  nextGuardId: number            // monotonic id counter shared by guards + paGuards
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
  debtEverCleared?: boolean     // true once the player has paid off debt to zero for the first time
  conditions?: PlayerCondition[]  // persistent status effects (e.g. radscorpion venom)
}

export interface SettlementMarket {
  prices: Record<string, number>  // chemId -> current price
  stock: Record<string, number>   // chemId -> units available this turn
  lastRefreshed: number           // turn number
  depletion: Record<string, number>  // chemId -> debt units suppressing stock below a fresh roll, decays over turns away
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

export interface CombatEffect {
  kind: 'heal' | 'accuracy_buff'
  healAmount?: number             // stimpak: 25
  accuracyBuffFraction?: number   // jet: 0.25, ultrajet: 0.50 — applied as (1 - currentAccuracy) * fraction
  buffDurationRounds?: number     // jet/ultrajet: 2
}

export interface ActiveBuff {
  id: string                       // `${chemId}_${targetId}_${seq}` — React key only
  chemId: string                   // 'jet' | 'ultrajet'
  targetKind: 'player' | 'guard' | 'pa_guard'
  targetId: string                 // 'player' | GuardUnit.id | PAGuardUnit.id
  accuracyBonus: number            // flat addition to hit-chance roll, computed once at apply time
  roundsRemaining: number          // 2 -> 1 after this round resolves -> 0 -> removed
}

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
  waveNumber: number            // 1 = normal, 2 = second wave, 3, 4 = late-game free-play escalation
  isCheckpointFight: boolean    // combat initiated by fighting a brotherhood/NCR checkpoint
  priorWaveCapsLooted: number   // caps from earlier wave(s) — added to summary display
  priorWaveXpGained: number     // XP from earlier wave(s) — added to summary display
  priorWaveEnemyLoot: Record<string, number>  // loot from earlier wave(s)
  closeCall?: boolean           // true when combat ended with player < 10 HP and 0 AP
  enragedEnemyIds?: string[]   // enemy ids that deal +20% damage next turn (set on failed tame)
  playerVenomed?: boolean      // cazador venom active: -30% accuracy, +5 HP DoT per round
  activeBuffs: ActiveBuff[]        // combat-scoped, cleared with the rest of `combat` when combat ends
  chemUsedThisRound: boolean       // per-round cap shared by manual chem use AND Medic auto-use
}

export type AnimStep =
  | {
      kind: 'shot'
      by: 'player' | 'guard' | 'pa_guard'
      shooterId: string | null  // null for player; GuardUnit.id / PAGuardUnit.id for guards
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
      kind: 'enemy_attack'
      enemyId: string
      hit: boolean
      damage: number
      targetKind: 'player' | 'guard' | 'pa_guard' | 'mount'
      targetId: string
      targetHealthAfter: number   // health for player/mount; unit.health for guard/pa_guard
      targetDied: boolean
      armorAbsorbed?: number      // only set when targetKind === 'player'
      logLine: string
      venomApplied?: boolean
      venomDotDamage?: number
    }
  | {
      kind: 'chem_use'   // Medic auto-trigger only — manual player chem use needs no AnimStep
      chemId: string
      targetKind: 'player' | 'guard' | 'pa_guard'
      targetId: string
      healAmount: number
      targetHealthAfter: number
      logLine: string
    }
  | {
      kind: 'burst'   // rapid multi-shot (minigun) — all shots animate in quick succession
      shots: Array<{
        targetId: string | null
        hit: boolean
        damage: number
        targetDied: boolean
        targetHealthAfter: number
        logLine: string
      }>
    }
  | {
      kind: 'pa_burst'  // PA guard minigun burst — same timing as burst, keyed to a guard slot
      shooterId: string
      shots: Array<{
        targetId: string | null
        hit: boolean
        damage: number
        targetDied: boolean
        targetHealthAfter: number
        logLine: string
      }>
    }
  | {
      kind: 'blast'
      shooterId: string | null   // null = player, otherwise the firing guard's id
      // Primary target (direct hit)
      primaryTargetId: string
      primaryDamage: number
      primaryDied: boolean
      primaryHealthAfter: number
      // Splash targets — all animate simultaneously with the primary
      splashHits: Array<{ targetId: string; damage: number; died: boolean; healthAfter: number; logLine: string }>
      logLine: string   // primary hit log line
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
  pendingDebtFreedom: number | null        // XP amount to celebrate when debt first cleared
  pendingDiscovery: { settlementId: string; xpGained: number } | null  // first-visit reward splash
  stats: import('./stats').RunStats
  earnedAchievements: import('./achievement').EarnedAchievement[]
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
