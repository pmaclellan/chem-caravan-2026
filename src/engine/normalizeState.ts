import { GAME_MODES } from '../data/modes'
import { GUARD_CLASSES } from '../data/guardClasses'
import type { GameModeId, GameState, PlayerState } from '../types/game'
import { initStats } from './statsReducer'

const VALID_MODES = new Set<GameModeId>(['commonwealth', 'capital_wasteland', 'mojave_wasteland'])

// Coerce missing or invalid fields for backward compatibility with old saves. Kept dependency-free
// (no Supabase/React imports) so both the live game store and the local run-history admin tool can
// import it directly.
export function normalizeState(state: GameState): GameState {
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
    // Pre-armor saves stored PAGuardUnit without armorPoints/maxArmorPoints — default them in.
    ? (legacyPlayer.paGuards as Array<Partial<PlayerState['paGuards'][number]>>).map(g => ({
        id: g.id!,
        health: g.health!,
        maxHealth: g.maxHealth!,
        armorPoints: g.armorPoints ?? mc.powerArmorGuardArmorPoints,
        maxArmorPoints: g.maxArmorPoints ?? mc.powerArmorGuardArmorPoints,
        dead: g.dead ?? false,
      }))
    : Array.from({ length: typeof legacyPlayer.powerArmorGuards === 'number' ? legacyPlayer.powerArmorGuards : 0 }, (_, i) => ({
        id: `pa_guard_legacy_${i}`,
        health: mc.powerArmorGuardHealth,
        maxHealth: mc.powerArmorGuardHealth,
        armorPoints: mc.powerArmorGuardArmorPoints,
        maxArmorPoints: mc.powerArmorGuardArmorPoints,
        dead: false,
      }))
  const nextGuardId = legacyPlayer.nextGuardId ?? (guards.length + paGuards.length)

  // Defends against a save corrupted by a since-fixed bug that could write NaN/null into
  // core numeric player fields (NaN round-trips through JSON as null) — coerce back to a
  // safe, non-crashing value rather than leaving null for every .toLocaleString() call site.
  const caps = Number.isFinite(state.player.caps) ? state.player.caps : 0
  const health = Number.isFinite(state.player.health) ? state.player.health : (state.player.maxHealth ?? mc.startingHealth)
  // brahmin never got this same coercion — a missing/non-finite value here silently poisons
  // runEscapeChance() (brahmin * RUN_BRAHMIN_PENALTY -> NaN), and since `Math.random() < NaN`
  // is always false, every flee attempt then fails deterministically instead of at normal odds.
  const brahmin = Number.isFinite(state.player.brahmin) ? state.player.brahmin : 0

  return {
    ...state,
    mode,
    gameType: state.gameType ?? 'standard',
    recap: state.recap ?? null,
    player: {
      ...state.player,
      caps,
      health,
      brahmin,
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
    combat: state.combat ? (() => {
      // Pre-medic-rework saves stored a boolean chemUsedThisRound instead of a count.
      const legacyCombat = state.combat as unknown as { chemUsedThisRound?: boolean; chemUsesThisRound?: number }
      return {
        ...state.combat,
        activeBuffs: state.combat.activeBuffs ?? [],
        chemUsesThisRound: typeof legacyCombat.chemUsesThisRound === 'number'
          ? legacyCombat.chemUsesThisRound
          : (legacyCombat.chemUsedThisRound ? 1 : 0),
        replaySteps: state.combat.replaySteps ?? [],
      }
    })() : state.combat,
    pendingDebtFreedom: state.pendingDebtFreedom ?? null,
    pendingDiscovery: state.pendingDiscovery ?? null,
    // Drop explicit nulls (same NaN-through-JSON corruption as above) before merging onto
    // defaults — a plain spread would let a null survive and overwrite initStats()'s 0.
    stats: state.stats
      ? { ...initStats(), ...Object.fromEntries(Object.entries(state.stats).filter(([, v]) => v !== null)) }
      : initStats(),
    earnedAchievements: state.earnedAchievements ?? [],
    combatReplays: state.combatReplays ?? [],
    // Pre-price-tracking saves predate localPrices/chemsSoldToDate — default them in so the
    // recap's missed-sale digest can skip those turns instead of crashing on undefined.
    history: (state.history ?? []).map(snapshot => ({
      ...snapshot,
      localPrices: snapshot.localPrices ?? {},
      chemsSoldToDate: snapshot.chemsSoldToDate ?? {},
    })),
  }
}
