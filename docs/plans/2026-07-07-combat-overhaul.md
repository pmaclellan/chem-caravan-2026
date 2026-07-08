# Combat Overhaul: Persistent Guard HP, Usable Chems, Guard Classes, Wave Escalation

## Context

The current combat damage system (`resolveFight()` in `src/engine/combat.ts:107-420`) pools all enemy damage per round into one number and cascades it through a fixed order — PA guards → regular guards → armor → mount → player HP — using floor-division "bucket" math (`Math.floor(totalIncoming / guardHealth)` guards die outright, no partial damage). This works but feels arbitrary (a 49-damage hit kills zero guards, a 50-damage hit kills one) and overly safe (the player is fully shielded until the entire guard roster is spent, no matter how many guards there are).

This plan replaces that system with **individually-tracked guard HP** (guards become persistent objects, not counts) resolved via **per-attack random targeting**, and layers three related features on top that all build on the same guard-as-individual-unit foundation: **usable combat chems** (Stimpak/Jet/Ultrajet), **guard classes** (Standard/Shotgunner/Sniper/Medic), and **turn-gated extra combat waves** in free play (3rd wave after turn 50, 4th after turn 75). Guard HP now persists across waves *and* across separate encounters — a guard can walk into the next fight already wounded — and heals for free when the caravan visits any settlement with a doctor.

Four design forks were resolved with the user before this plan was written (all "Recommended" options accepted):
1. **Targeting**: per-attack random targeting, weighted toward the front line (each enemy attacker independently rolls a target from the whole living roster; a guard can survive a hit at partial HP).
2. **Chem action economy**: using a chem is free (doesn't consume the FIGHT/RUN action) but capped at 1 use per round across the whole party.
3. **Power Armor**: stays a fully separate, unclassed track (own cost/salary/roster cap/desertion priority) — the new class system applies only to regular guards.
4. **Buff duration**: Jet/Ultrajet accuracy buffs last 2 combat rounds, shown via a persistent "rounds remaining" badge.

Two further rounds of feedback after the plan's first draft added two more pieces, each resolved below:
5. **Enemy attacks now animate individually** (see Phase 1's animation section) rather than as one pooled "retaliation" blob, since each one can land on a different target. Enemies currently have **zero miss chance** — every attack always lands for its full rolled damage — confirmed by direct read of `resolveFight()`'s retaliation block. Decision: add a real per-attack accuracy roll now that misses have somewhere to be shown (a dodge animation), rather than deferring it.
6. **Settlement chem stock now persists and depletes when bought**, rather than being fully re-rolled from scratch on every visit (confirmed by direct read of `refreshMarket()` — it currently just calls `initializeMarket()` again, discarding all prior state). Decisions: applies to all chems, not just combat ones; recovers gradually over turns away rather than a hard cooldown wall, but with an explicit "back to full in ~N turns" readout so the gradual mechanic doesn't feel opaque; purchase-driven depletion does **not** raise price (the user's own reasoning: coupling the two would let a player buy up stock to spike the price, then return a couple of turns later to sell into their own artificial spike for free profit — keeping quantity and price orthogonal closes that loop).

This was scoped via direct reads of `combat.ts`, `types/game.ts`, `economy.ts`, `gameLoop.ts`, `modes/index.ts`, `chems.ts`, `tuning.ts`, `taming.ts`, `gameStore.ts`, `CombatPanel.tsx`, `FollowersPanel.tsx`, `DoctorPanel.tsx`, and `MobileGame.tsx`, plus a `grep` confirming 55 usages of `.guards`/`.powerArmorGuards` across 14 files. Two things changed scope from the original ask and are called out below.

### Scope corrections found during research

- **`src/engine/taming.ts:resolveFailedTame()` (lines 53-117) duplicates the exact same PA→Guard→Armor→HP bucket cascade** as `combat.ts`. It's a second, independent copy (confirmed by direct read) that fires when the player abandons the taming minigame and the creature retaliates. It must be migrated onto the same new targeting logic in the same phase, or it will keep using stale bucket math against the new array-shaped guard state and break the build.
- **`MobileGame.tsx` does not duplicate the combat/hiring UI.** It renders `<CombatPanel player={player} combat={combat} />` (line 618) and `<FollowersPanel player={player} />` (line 514) directly — confirmed by direct read. All UI work for this overhaul happens once, in `CombatPanel.tsx` and `FollowersPanel.tsx`, and both desktop and mobile get it for free. `MobileGame.tsx` only needs two mechanical fixes: an inline guard/PA count summary at lines 228 and 232 that currently read `player.guards`/`player.powerArmorGuards` as numbers.

---

## New/changed types (`src/types/game.ts`)

```ts
export type GuardClassId = 'standard' | 'shotgunner' | 'sniper' | 'medic'

export interface GuardUnit {
  id: string            // "guard_7" — assigned from PlayerState.nextGuardId at hire time
  classId: GuardClassId
  health: number
  maxHealth: number
  dead: boolean          // true once killed in combat; pruned on arrival at the next settlement
}

export interface PAGuardUnit {
  id: string             // "pa_guard_3" — same id counter as GuardUnit, no classId (PA stays unclassed)
  health: number
  maxHealth: number
  dead: boolean
}

// PlayerState changes:
//   guards: GuardUnit[]                          (was: number)
//   powerArmorGuards -> paGuards: PAGuardUnit[]   (was: number, renamed)
//   nextGuardId: number                           (new — monotonic id counter shared by both rosters)

export interface CombatEffect {
  kind: 'heal' | 'accuracy_buff'
  healAmount?: number             // stimpak: 25
  accuracyBuffFraction?: number   // jet: 0.25, ultrajet: 0.50 — applied as (1 - currentAccuracy) * fraction
  buffDurationRounds?: number     // jet/ultrajet: 2
}
// ChemDefinition (src/data/chems.ts) gains: combatEffect?: CombatEffect

export interface ActiveBuff {
  id: string                       // `${chemId}_${targetId}_${seq}` — React key only
  chemId: string                   // 'jet' | 'ultrajet'
  targetKind: 'player' | 'guard' | 'pa_guard'
  targetId: string                 // 'player' | GuardUnit.id | PAGuardUnit.id
  accuracyBonus: number            // flat addition to hit-chance roll, computed once at apply time
  roundsRemaining: number          // 2 -> 1 after this round resolves -> 0 -> removed
}

// CombatState additions:
//   activeBuffs: ActiveBuff[]        // combat-scoped, cleared with the rest of `combat` when combat ends
//   chemUsedThisRound: boolean       // per-round cap shared by manual use AND Medic auto-use
//   waveNumber: number               // already exists — now genuinely goes up to 4
```

`AnimStep` union changes: `'shot'` and `'pa_burst'` swap `guardIdx: number` for `shooterId: string | null` (`null` = player) — guards get addressable ids the same way `EnemyUnit.id` already works, instead of positional indices. The old aggregated `'retaliation'` step (flat `guardsLost`/`paGuardsLost` counts, one blob per round) is **replaced entirely** by a new `'enemy_attack'` step emitted once per individual enemy attack, each independently targeted and individually animated — see Phase 1's animation section below for the full shape and timing. New `'chem_use'` step for Medic auto-triggers only (manual player chem use is an instant out-of-round mutation, like Antivenom today, and needs no AnimStep).

New file `src/data/guardClasses.ts`:

```ts
export interface GuardClassDefinition {
  id: GuardClassId
  name: string
  description: string
  accuracy: number
  damage: [number, number]
  health: number
  hireCost: number
  salaryPerTurn: number
  splashRatios?: number[]   // shotgunner only — reuses the existing gun-splash mechanic
  isMedic?: boolean
}
export const GUARD_CLASSES: Record<GuardClassId, GuardClassDefinition> = { ... }
```

Starting balance (tunable, benchmarked against today's flat guard: 0.55 acc, [20,35] dmg, 50 HP, 150¤ hire, 35¤/turn):

| Class | Accuracy | Damage | Splash | HP | Hire | Salary/turn |
|---|---|---|---|---|---|---|
| Standard | 0.55 | [20,35] | — | 50 | 150¤ | 35¤ |
| Shotgunner | 0.70 | [10,18] | [0.60, 0.35] to 2 more alive enemies | 50 | 180¤ | 40¤ |
| Sniper | 0.35 | [45,70] | — | 40 | 200¤ | 45¤ |
| Medic | 0.40 | [10,18] | — | 55 | 175¤ | 40¤ |

`modes/index.ts`: remove `guardCost, guardSalaryPerTurn, guardHealth, guardAccuracy, guardDamage` from `GameModeConfig` (single-site edit — `capital_wasteland`/`mojave_wasteland` inherit these via `...COMMONWEALTH_MODE` spread, no per-mode overrides exist). Keep `maxGuards` and all `powerArmorGuard*` fields untouched.

---

## Phase 1 — Guard HP model + per-attack targeting (foundation; everything else depends on this)

**`src/engine/combat.ts`**: rewrite the "surviving enemies attack" block (lines 308-381) from pooled-damage cascade to per-attack independent resolution. New shared, exported helpers so `taming.ts` can reuse them (killing its duplicate cascade):

```ts
export interface TargetRef { kind: 'player' | 'guard' | 'pa_guard' | 'mount'; id: string; weight: number }
export const TARGET_WEIGHTS = { player: 1, paGuard: 4, guard: 2, mount: 2 }  // tunable
export function buildTargetRoster(player, guards: GuardUnit[], paGuards: PAGuardUnit[], mount): TargetRef[]
// Applies a landed hit (accuracy already resolved by the caller — see "Enemy accuracy" below)
// against a chosen target. Returns updated state plus enough info to build the 'enemy_attack' AnimStep directly.
export function resolveSingleAttack(target: TargetRef, damage: number, health, guards, paGuards, mount, armor): { health, guards, paGuards, mount, armor, targetHealthAfter: number, armorAbsorbed?: number }
```

Loop: for each alive enemy this round, roll its damage and `rngWeightedPick(roster)` a target (reuse the existing `rngWeightedPick` from `src/engine/rng.ts` — no new RNG primitive needed), then roll accuracy (see "Enemy accuracy" below) — on a hit, call `resolveSingleAttack` and build a `hit: true` `'enemy_attack'` step from its return; on a miss, skip the state mutation entirely and build a `hit: false` step directly. Remove dead targets from the roster so they can't be hit again this round; stop early if the player dies. **Armor mitigates only attacks that land on the player** — the natural reading of independent per-attack resolution. `resolveRun()` (fleeing/caught retaliation, lines 422-492) is intentionally left untouched — still a single pooled hit against player HP/armor only, no accuracy roll — since getting caught fleeing reads as "you personally get run down," distinct from a standing firefight.

**`src/engine/taming.ts`**: rewrite `resolveFailedTame()` (lines 53-117) to call `resolveSingleAttack()`/`buildTargetRoster()` instead of its own inline copy of the bucket cascade, including the same accuracy roll (default 0.80, or the tamed creature's own `enemyStats.accuracy` if set) before applying it — a failed tame attempt should be able to miss too, for the same reason a standing firefight attack can.

**Animation — revised to animate each enemy attack individually** (superseding an earlier draft of this plan that proposed one aggregated retaliation blob per round; the user asked for per-attack animation once damage started landing on independently-chosen targets). New `AnimStep` kind, pushed once per enemy attack in sequence (not batched):

```ts
| {
    kind: 'enemy_attack'
    enemyId: string
    hit: boolean
    damage: number
    targetKind: 'player' | 'guard' | 'pa_guard' | 'mount'
    targetId: string
    targetHealthAfter: number   // health for player/mount; unit.health for guard/pa_guard
    armorAbsorbed?: number      // only set when targetKind === 'player'
    logLine: string
  }
```

**Enemy accuracy (new):** enemies currently always hit — confirmed no roll exists today. Add an optional `accuracy?: number` to each mode's `enemyStats` entries (`modes/index.ts`), defaulting to `0.80` when unset so this doesn't require populating every enemy across all three modes immediately; `resolveSingleAttack`'s caller rolls `rng() < accuracy` per enemy attack before calling it, and a miss produces `hit: false` on the `'enemy_attack'` step with no state change.

**`src/hooks/useCombatAnimation.ts`**: new case for `step.kind === 'enemy_attack'`, spaced by a new `INTER_ENEMY_ATTACK_MS` constant (propose `480`, vs. the existing `INTER_SHOT_MS = 620` for player/guard shots — enemy retaliation should read as a slightly quicker, more frantic barrage than the caravan's own deliberate shots). Per step: **Phase A** (at `offset`) marks only that specific `enemyId` as `type: 'attack'` in `enemyAnimInfo` (an improvement over today's "all alive enemies lunge at once regardless of who's actually attacking"). **Phase B** (at `offset + ATTACK_LAND_DELAY`): if `hit`, update the specific target's display value and fire a damage-flash key — branch on `targetKind`: `'player'` updates `displayPlayerHealth`/`displayPlayerAP` (split via `armorAbsorbed`) and `playerDamageKey`; `'guard'`/`'pa_guard'` update the new `displayGuardHealth[targetId]`/`displayPAGuardHealth[targetId]` maps (added in the guard-HP-model work above) and a new `guardDamageKeys[targetId]` flash (distinct from the existing `guardFireKeys`, which is for when *they* shoot); `'mount'` updates `displayMountHealth` and a new `mountDamageKey` (distinct from `mountFireKey`). If `!hit`, trigger a **dodge** flash on the target's card instead of a damage flash — `playerDodgeKey` / `guardDodgeKeys[targetId]` / `mountDodgeKey`.

**`src/components/game/CombatPanel.tsx`**: add a dodge/sidestep keyframe to the existing `KEYFRAMES` template string, mirroring `enemyDodge` (`EnemyUnitCard.tsx:14`, "smooth slide right") but applied to the player/guard/PA-guard/mount mini-cards instead of enemy cards — same visual grammar (a target that avoided a hit slides, one that took a hit flashes), just mirrored to the other side of the battlefield. Follows the file's existing pattern of small purpose-built overlay components (`GuardGlow`, `PlayerCardFire`, `MountGlow`) — add one more for the dodge case, or extend those existing ones with a `variant: 'hit' | 'dodge'` prop.

**`src/components/game/CombatPanel.tsx`**: the "Protectors" row (lines 298-430) changes from `Array.from({length: totalGuards})` positional rendering to mapping directly over `player.guards`/`player.paGuards`, keyed by unit id, each card getting a real partial-HP bar (`hpPct = health/maxHealth`) instead of the current binary green/greyed-out state. Extract a shared `GuardUnitCard.tsx` (new file, sibling to the existing `EnemyUnitCard.tsx`, reusing its HP-bar/dead-skull/flash-overlay structure) parameterized by icon + border color, instead of the current duplicated inline JSX for guard vs. PA-guard cards.

**`src/engine/economy.ts`**: `hireGuards`/`buyPowerArmorGuard` push new `GuardUnit`/`PAGuardUnit` objects (ids from `player.nextGuardId`) instead of incrementing a count. `totalGuardSalary()` sums live (non-dead) units' class-specific salaries. `applyGuardSalary()`'s desertion loop (lines 368-379) splices out specific units instead of decrementing a number — desert regular guards before PA guards (unchanged priority), highest-salary class first among regulars.

**`src/engine/gameLoop.ts`, `completeTravel()`** (near the existing `applyGuardSalary()` call at lines 259-265): add dead-guard pruning (`player.guards.filter(g => !g.dead)`, same for `paGuards` — unconditional, every arrival) **and** free doctor auto-heal, gated on `settlement?.hasDoctor`:

```ts
player = {
  ...player,
  guards: player.guards.filter(g => !g.dead).map(g => settlement?.hasDoctor ? { ...g, health: g.maxHealth } : g),
  paGuards: player.paGuards.filter(g => !g.dead).map(g => settlement?.hasDoctor ? { ...g, health: g.maxHealth } : g),
}
```

This is the single choke point satisfying "guards persist wounded across waves and encounters, heal free at any settlement with a doctor, mercenaries handle it themselves" — no new button, no cost, reuses the existing per-turn bookkeeping location.

**`src/engine/tuning.ts`**: `runEscapeChance(guards, paGuards, brahmin)` signature unchanged — callers pass `.filter(g => !g.dead).length` instead of the raw field.

**`src/store/gameStore.ts`**: `normalizeState()` (lines 149-183) gets a migration branch converting legacy `guards: number` / `powerArmorGuards: number` saves into arrays of full-HP `GuardUnit`/`PAGuardUnit` objects (all legacy guards become `classId: 'standard'` since that's the only class that existed before; HP source of truth for the fallback is `GUARD_CLASSES.standard.health`, avoiding a second hardcoded constant). Also default `combat.activeBuffs ?? []` and `combat.chemUsedThisRound ?? false` for saves captured mid-combat before this ships.

**Mechanical `.length`-based fixes** (no behavior change, just compile fixes for the new array shape): `src/components/game/PlayerStats.tsx`, `src/components/game/EventPanel.tsx`, `src/engine/achievementChecker.ts`, `src/components/game/service-panels/FollowersPanel.tsx` (payroll summary numbers only in this phase — class-picker UI comes in Phase 3), `src/components/game/MobileGame.tsx` (lines 228, 232).

---

## Phase 2 — Usable chems (Stimpak/Jet/Ultrajet)

**`src/data/chems.ts`**: add `combatEffect` to the `stimpak`/`jet`/`ultrajet` entries (`{kind:'heal', healAmount:25}`, `{kind:'accuracy_buff', accuracyBuffFraction:0.25, buffDurationRounds:2}`, `{kind:'accuracy_buff', accuracyBuffFraction:0.50, buffDurationRounds:2}`).

**`src/store/gameStore.ts`**: three new actions modeled directly on the existing `useAntivenom()` (lines 910-924) — `useStimpakInCombat`, `useJetInCombat`, `useUltrajetInCombat`, each `(targetKind: 'player'|'guard'|'pa_guard', targetId: string) => void`. Pure `mutate()` calls — **no `resolveFight()` call, no phase transition** (matches the "free action" decision and the Antivenom precedent exactly). Guard against `combat.chemUsedThisRound`, zero inventory, or a dead/missing target. On success: decrement inventory, apply the effect (heal: clamp to `maxHealth`; buff: compute `accuracyBonus = (1 - currentAccuracy) * fraction` and push an `ActiveBuff` with `roundsRemaining: 2`), set `chemUsedThisRound = true`, log it.

**`src/engine/combat.ts`**: tick buffs once per round (`roundsRemaining - 1`, filter out expired) and reset `chemUsedThisRound = false` for the next round, inside `resolveFight()`/`resolveRun()`. Apply `accuracyBonus` at each firer's accuracy roll (player gun, each guard/PA guard) via a lookup by `targetKind`+`targetId`, clamped to a 0.95 ceiling (mirrors the existing 0.10–0.90 clamp style already used in `runEscapeChance`).

**`src/components/game/CombatPanel.tsx`**: reusing this codebase's own established pip-boy visual language (`--pip-green/-amber/-red/-blue` CSS vars, `.pip-label`/`.pip-btn*`, bordered 40×40 mini-cards with a caption — confirmed via the existing Protectors row and `EnemyUnitCard.tsx`, not a generic from-scratch UI) — add:
- A small buff-rounds-remaining pill under any unit's HP bar when `combat.activeBuffs` has an entry for it (`JET · 2`, amber; `ULTRAJET · 1`, blue — reusing existing tokens rather than adding a new color).
- A "Field Medicine" mini-panel below the Protectors row, above the existing venom/antivenom banner (line 432): one row per owned chem, a compact target selector (small icon buttons for YOU + each living guard/PA-guard, same visual language as the Protectors row), one `USE` button per chem, disabled with a one-line caption ("Already treated this round") when `chemUsedThisRound` is true.

---

## Phase 3 — Guard classes

**`src/data/guardClasses.ts`**: `GUARD_CLASSES` data (table above). **`src/engine/economy.ts`**: `hireGuards(player, classId, count, maxGuards)` gains a `classId` param, reads cost/health from `GUARD_CLASSES[classId]`. **`src/components/game/service-panels/FollowersPanel.tsx`**: replace the single "GUARDS" section (lines 62-88) with four per-class hire mini-cards (acc/dmg/HP/cost/salary + `[1,2,3]` hire buttons), gated by total live regular-guard count vs. `mc.maxGuards`. "POWER ARMOR GUARDS" section unchanged aside from the `.length` swap already done in Phase 1.

**`src/engine/combat.ts`**: per-class fire behavior in the guard-firing loop (lines 230-283) — Shotgunner splash reuses an `applySplashDamage()` helper extracted from the existing player-gun splash logic (lines 163-178, currently inline) so there's one splash implementation, not two. Medic: after its own shot, if `!chemUsedThisRound` and the player has stimpak in inventory and any eligible ally (player + guards + PA guards, mount excluded, same eligible set as manual use) is below max HP, auto-heal the most-wounded one for 25, decrement inventory, set `chemUsedThisRound = true`, emit a `'chem_use'` AnimStep (this one *is* animated/logged, unlike manual use, since it happens mid-round inside the timed sequence). If a second Medic checks after the flag is already set, log that it found no opening rather than silently no-oping.

---

## Phase 4 — Turn-gated wave escalation (turn 50 → wave 3, turn 75 → wave 4)

Fully independent of Phases 1–3 (touches none of the guard/chem machinery) — can ship in any order relative to them.

**Bug fix required as part of this phase**: `afterCombat()`'s wave-chaining payload construction (`gameLoop.ts:562-567`) currently sets `priorWaveCaps`/`priorWaveXp`/`priorWaveLoot` from *only the current wave's own take*, not summed with `combat.priorWaveCapsLooted`/`priorWaveXpGained`/`priorWaveEnemyLoot` (which already hold everything carried in from earlier waves). Invisible today because the chain is hard-capped at 2 waves; will silently under-report cumulative loot on the summary screen the moment 3+ waves are possible. Fix: `priorWaveCaps: combat.capsLooted + combat.priorWaveCapsLooted` (same additive pattern for XP and a merged loot map).

**`src/engine/tuning.ts`**: new `shouldEscalateWave(currentWave, dangerLevel, turn, gameType)`, generalizing the existing `rng() < road.dangerLevel - 0.40` shape (kept byte-identical for the wave 1→2 case, so no regression) with per-wave thresholds that tighten as waves stack:

```ts
const WAVE_MIN_DANGER = { 2: 0.55, 3: 0.65, 4: 0.75 }
const WAVE_TRIGGER_THRESHOLD = { 2: 0.40, 3: 0.50, 4: 0.60 }
const WAVE_TURN_GATE = { 3: 50, 4: 75 }  // no gate for wave 2
```

Standard mode is hard-capped at `maxTurns: 30`, so waves 3/4 are inherently unreachable there (free play has `maxTurns: null`) — still defensively gate on `gameType === 'free_play'` for waves 3/4 inside the function, purely so a future `maxTurns` tuning change can't silently leak this into standard mode.

**`src/engine/gameLoop.ts`**: `TravelEvent.payload`'s `isSecondEncounter: boolean` becomes `nextWaveNumber: number` at its two write/read sites (`afterCombat()`'s escalation block, `startCombat()`'s read at line 449). `afterCombat()`'s `isFirstEncounter` gate (lines 539-540) is deleted entirely — `combat.waveNumber` already tells us which wave just resolved, so the check becomes `if (shouldEscalateWave(combat.waveNumber, road.dangerLevel, turn, state.gameType))`.

New test file `src/engine/__tests__/gameLoop.test.ts` (none exists today) covering `shouldEscalateWave()`'s thresholds/turn-gates and the prior-wave-loot-summation fix (simulate a wave 1→2→3 chain, assert the final summary total equals the sum of all three waves, not just the last).

---

## Phase 5 — Settlement stock depletion

Fully independent of Phases 1–4 — no shared code with the guard/chem/wave work, touches the market system only. Confirmed by direct read that this is a genuinely new mechanic, not an extension of an existing one: `refreshMarket()` (`src/engine/market.ts:28-37`) takes an `_existing: SettlementMarket` param but never reads it — it just calls `initializeMarket()` again, so **stock is fully re-rolled from scratch on every single visit today**, with zero memory of prior purchases. `SettlementMarket.lastRefreshed: number` (already tracked) is the one piece of existing state this design reuses.

**Design**: purchases accumulate a persistent per-chem, per-settlement "debt" (units bought below what a fresh roll would have given), which decays continuously with turns elapsed since last visit — no hard cooldown wall, but the UI surfaces an explicit "back to full in ~N turns" projection computed from that same decay math, so the gradual mechanic still reads as legible and plannable rather than opaque. Applies uniformly to all chems (not just combat ones) — no special-casing needed, since combat chems (Stimpak `maxStock: 6`, Ultrajet `maxStock: 4`) already recover slower than high-volume trade goods (Gwinnett Ale `maxStock: 25`) purely because the recovery-rate formula scales with `maxStock`. Depletion affects **quantity only, never price** — deliberately, to close an arbitrage loop: coupling the two would let a player buy up stock (spiking price), then return a couple of turns later to sell into their own artificial spike for free profit.

**`src/types/game.ts`**: `SettlementMarket` gains `depletion: Record<string, number>` — raw debt units per chem, persisted as part of the settlement's market object (not reset by a fresh roll).

**`src/engine/market.ts`**: 
- New exported constant `RECOVERY_TURNS_TO_FULL = 5` (tunable) — single source of truth for the recovery-rate formula, consumed by both the engine and the UI so there's no duplicated math.
- `refreshMarket()` actually uses its `_existing` param now: for each chem, compute `turnsElapsed = turn - existing.lastRefreshed`, `recoveryRate = CHEMS[chemId].maxStock / RECOVERY_TURNS_TO_FULL`, `remainingDebt = max(0, (existing.depletion[chemId] ?? 0) - recoveryRate * turnsElapsed)`. Roll a fresh stock value exactly as `initializeMarket()` does today, then clamp: `stock[chemId] = max(0, freshRoll - remainingDebt)`. Carry `remainingDebt` forward into the returned market's `depletion` map (omit entries that decayed to 0, keeping the map small). Chems the player never bought into debt are completely unaffected — this only ever suppresses stock below what a fresh roll would have given, never inflates it.
- The `wandering_merchant` event's `syntheticMarket` path (`gameStore.ts:817`, `{prices, stock, lastRefreshed: 0}`) doesn't call `refreshMarket()` at all — it's a one-off event market, unaffected by this change.

**`src/store/gameStore.ts`**: the `buy()` action (lines 751-771) already calls `updateSettlementStock(state.world, loc, chemId, -quantity)` to decrement the current visit's in-memory stock. Add a parallel `updateSettlementDepletion(world, loc, chemId, +quantity)` helper (mirroring the existing `updateSettlementStock`, `gameStore.ts:60-72`) called alongside it, incrementing `depletion[chemId]` by the purchased quantity — this is the write side of the debt that `refreshMarket()` later decays and reads.

**`src/components/game/MarketPanel.tsx`**: the Stock column (line 36, values at line 75) gains a small "recovering ~Nt" caption whenever `market.depletion?.[chemId] > 0`, computed as `Math.ceil(depletion[chemId] / (CHEMS[chemId].maxStock / RECOVERY_TURNS_TO_FULL))` (imports `RECOVERY_TURNS_TO_FULL` from `market.ts` rather than re-deriving it). Style it as a dimmed/secondary caption beneath the stock number, following the same "small colored delta under the main value" convention this component already uses for the P/L column (lines 77-83) — no new visual primitive, just the existing pattern applied to a new column.

---

## Test files needing updates

- `src/engine/__tests__/combat.test.ts` — `makePlayer()` fixture needs `guards: []`/`paGuards: []`; existing guard-firing/absorption tests need `GuardUnit[]` fixtures; new tests for weighted per-attack targeting (mock `rng`), armor-only-on-player-hits, enemy accuracy/miss producing `hit: false` `'enemy_attack'` steps, buff apply/decay, Medic auto-heal, Shotgunner splash.
- `src/engine/__tests__/economy.test.ts` — same fixture change; guard-hire test currently asserts a numeric `result.guards` — needs to assert array length/contents; new class-aware salary/desertion tests.
- `src/engine/__tests__/travel.test.ts` — fixture change only, no functional logic touches guards here.
- `src/engine/__tests__/gameLoop.test.ts` — new, Phase 4.
- `src/engine/__tests__/market.test.ts` — Phase 5: new tests for `refreshMarket()` reading `_existing.depletion`/`lastRefreshed` correctly (debt decays proportionally to turns elapsed, stock never goes negative, undepleted chems unaffected), and for the `buy()` → `updateSettlementDepletion` write path.

## Verification

- `~/.nvm/versions/node/v22.22.3/bin/node ./node_modules/.bin/tsc --noEmit` after each phase (per project convention — default `node` is too old for `tsc`).
- Run the existing test suite; update fixtures per-phase as listed above.
- Start the dev server and manually play a combat encounter per phase: Phase 1 — verify guards take partial damage, survive at reduced HP into the next round, heal free at a settlement doctor visit, and that individual enemy attacks now animate one at a time (with an occasional miss/dodge) instead of one pooled blob; Phase 2 — use a Stimpak/Jet/Ultrajet on a guard mid-fight, confirm the round isn't consumed, confirm the 1-per-round cap and the 2-round buff badge countdown; Phase 3 — hire one of each guard class, confirm Shotgunner splash hits multiple enemies and Medic auto-heals a wounded ally; Phase 4 — in free play, push turn count past 50 and 75 on a high-danger road and confirm wave 3/4 can trigger, with correct cumulative loot on the summary screen; Phase 5 — buy out a settlement's Stimpak stock, confirm the market panel shows a "recovering" caption with a shrinking turn count, travel away and back, and confirm stock is partially (not fully) restored, growing toward full over further turns away.
