# Chem Caravan 2026 — Developer Guide

A reference for anyone picking up development on this project. Covers architecture, data flow, where things live, and how to extend the game.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Directory Structure](#directory-structure)
3. [Core Type System](#core-type-system)
4. [Data Layer](#data-layer)
5. [Engine Layer](#engine-layer)
6. [State Management](#state-management)
7. [UI Layer](#ui-layer)
8. [Mobile vs Desktop Architecture](#mobile-vs-desktop-architecture)
9. [CSS Theme System](#css-theme-system)
10. [Backend / Supabase](#backend--supabase)
11. [Key Patterns and Gotchas](#key-patterns-and-gotchas)
12. [How To: Add a New Chem](#how-to-add-a-new-chem)
13. [How To: Add a New Game Mode](#how-to-add-a-new-game-mode)
14. [How To: Add a New Travel Event Type](#how-to-add-a-new-travel-event-type)
15. [SVG Settlement Map](#svg-settlement-map)
16. [Adding Game Images](#adding-game-images)
17. [Running and Building](#running-and-building)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19, TypeScript 5.8 |
| Build tool | Vite 6 |
| State management | Zustand 5 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Backend / persistence | Supabase (Postgres + Auth) |
| Testing | Vitest + @testing-library/react |

No backend functions. All game logic runs client-side; Supabase is only used for auth, save persistence, and the leaderboard read.

---

## Directory Structure

```
src/
  types/
    game.ts              ← All shared TypeScript interfaces/types (canonical source of truth)

  data/
    chems.ts             ← Global chem registry (stats, prices, images)
    config.ts            ← Legacy CONFIG constants (mostly superseded by GameModeConfig)
    modes/
      index.ts           ← GameModeConfig interface + GAME_MODES registry
      commonwealth/      ← Fallout 4 mode data
        settlements.ts   ← Settlement and Road definitions + interfaces
        events.ts        ← TravelEventDefinition list
        guns.ts          ← Gun definitions
        quotes.ts        ← Transit flavor quotes
        enemies.ts       ← (imported via index.ts enemies array)
        index.ts
      capital_wasteland/ ← Fallout 3 mode (same file structure)
      mojave_wasteland/  ← Fallout: New Vegas mode (same file structure)

  engine/
    gameLoop.ts          ← Phase transitions: init, travel, events, combat, game over
    combat.ts            ← Fight and run resolution (pure functions)
    economy.ts           ← All financial operations (pure functions)
    travel.ts            ← Road queries, event selection, capacity, brahmin loss
    market.ts            ← Market init, refresh, event application
    xp.ts                ← XP system: XpEventType, calculateXp, awardXp, getScaleFactor
    rng.ts               ← Random number wrapper (swap to seeded PRNG here)
    __tests__/           ← Vitest unit tests for engine modules

  store/
    gameStore.ts         ← Zustand game store: all actions + Supabase sync
    authStore.ts         ← Zustand auth store: sign in/up/out

  components/
    game/
      MobileGame.tsx     ← Full mobile layout (5-tab, self-contained)
      CombatPanel.tsx    ← Desktop combat UI
      CombatSummaryPanel.tsx
      EventPanel.tsx     ← Travel event UI (fight/run/pay choices)
      MarketPanel.tsx
      MapPanel.tsx       ← Settlement map + travel buttons
      SettlementMap.tsx  ← SVG map renderer
      ServicesPanel.tsx  ← Doctor, bank, loanshark, guards, brahmin, guns
      InventoryPanel.tsx
      PlayerStats.tsx
      GameLog.tsx
      TravelSplash.tsx   ← Transit quote screen
      TravelPanel.tsx
      EnemyUnitCard.tsx
      enemySvgs.ts       ← Inline SVG strings for enemy art
    ui/
      FlashOverlay.tsx   ← Full-screen flash on damage/profit
      FlashText.tsx      ← Single value flash animation
      HowToPlay.tsx
    auth/
      AuthModal.tsx

  pages/
    Game.tsx             ← Desktop game page + GameOverScreen
    Home.tsx             ← Landing page / save slot selection
    HowToPlay.tsx
    Leaderboard.tsx

  hooks/
    useIsMobile.ts       ← Breakpoint detection (< 768px)
    useValueFlash.ts     ← Flash key + direction on numeric value change
    useMapFlash.ts       ← Flash map for multiple values (inventory quantities)

  utils/
    priceColor.ts        ← Positional color encoding for prices

  lib/
    supabase.ts          ← Supabase client (reads VITE_SUPABASE_URL/KEY from env)

  App.tsx                ← Router setup + auth initialization
  main.tsx               ← React entry point

supabase/
  migrations/            ← Sequential SQL files applied to Supabase project
    001_initial_schema.sql
    002_rls.sql
    003_add_mode_turns.sql
    004_leaderboard_public_reads.sql
    005_add_game_type.sql  ← adds game_type column ('standard' | 'free_play')

public/
  assets/
    settlements/         ← Settlement background images (.webp/.jpg)
```

---

## Core Type System

Everything lives in `src/types/game.ts`. This is the single source of truth for game data shapes.

### Key types

**`GameState`** — the entire game serialized to Supabase on every mutate:
```
mode            GameModeId          which wasteland
player          PlayerState         player stats, caps, inventory, gun, debt tracking
world           WorldState          turn, markets, active market events
phase           GamePhase           controls which UI is rendered
pendingEvent    TravelEvent | null  event waiting for player choice
pendingDestination string | null    where the player is heading
pendingQuote    TransitQuote | null flavor quote shown on transit splash
combat          CombatState | null  present only during combat phases
gameOverReason  GameOverReason | null
endReason       string | null       human-readable death reason
log             LogEntry[]          append-only run log
```

**`GamePhase`** — the central state machine:
```
settlement      → at a settlement; market/travel/services tabs active
traveling       → transit splash shown, waiting for player to click Continue
event           → travel event panel shown, waiting for player choice
combat          → combat panel active, fight/run buttons
combat_summary  → post-combat summary, then transitions to settlement on dismiss
game_over       → death/win screen
```

**`PlayerState`** — notable fields:
- `inventory: Record<string, InventoryEntry>` — sparse map; missing key = 0 quantity
- `InventoryEntry.pricePaid` — weighted average cost basis for P&L display
- `debtPaidThisCycle` — caps paid toward debt since last turn tick; resets each tick
- `debtWindowCapsPaid` — cumulative payment in the current enforcement window
- `debtWindowStartAge` — ageOfDebt when the current payment window opened
- `debtWarnings` — escalation counter (0 = first visit, 1 = second, 2+ = lethal)

**`SettlementMarket`** — market state stored in `WorldState.settlements[id]`. Prices have active market events applied when read via `applyMarketEvents()` in `engine/market.ts`. The raw (unadjusted) version is stored; the adjusted version is computed on demand.

---

## Data Layer

### `src/data/chems.ts` — Global Chem Registry

All chems ever used in any mode are registered here as `ChemDefinition`:
- `basePrice`, `priceVariance` (fraction ±), `availability` (0–1), `maxStock`
- `highPriceMsg` / `lowPriceMsg` — flavor text shown in market event log
- `msgOverrides` — per-mode overrides for high/low messages (keyed by `GameModeId`)
- `imageUrl` — local asset or Fandom CDN URL (see gotchas below)

Each mode's `availableChemIds: string[]` in `GameModeConfig` is a subset of `CHEMS` keys.

### `src/data/config.ts` — Legacy CONFIG

This file predates the multi-mode system and holds some legacy constants. Most of these values are now duplicated into `GameModeConfig` in `data/modes/index.ts`. The `CONFIG` object is still referenced by a few engine functions (`calculateCapacity` in `travel.ts`) as defaults when no mode config is passed. When adding per-mode variation, put the value in `GameModeConfig`, not here.

### `src/data/modes/index.ts` — Game Mode System

This is the heart of the multi-mode architecture.

**`GameModeConfig`** interface — everything that varies per mode:
- Economy parameters (interest rate, starting caps/debt, turn limit)
- Debt enforcement schedule (`debtEnforcement: DebtEnforcementEntry[]`)
- Debt window parameters (`debtGracePeriod`, `debtWindowSize`, `debtMinPaymentRate`, `debtCollectorProb`)
- Enemy roster with stats (`enemies: EnemyType[]`, `enemyStats: Record<string, { health, damage }>`)
- Market event probabilities
- Settlement/road/gun data imported from the mode's subdirectory
- `mapPositions` — SVG coordinate layout for the settlement map
- `availableChemIds` — which chems appear in this mode's markets

**`GAME_MODES: Record<GameModeId, GameModeConfig>`** — the registry. Capital Wasteland and Mojave Wasteland configs use spread (`...COMMONWEALTH_MODE`) to inherit defaults and override only what differs.

Each mode subdirectory (`commonwealth/`, `capital_wasteland/`, `mojave_wasteland/`) contains:
- `settlements.ts` — `Settlement` and `Road` definitions (interfaces defined in commonwealth, re-used by others)
- `events.ts` — `TravelEventDefinition[]` array (weights, min danger levels, flavor text)
- `guns.ts` — `GunDefinition[]` with price, damage, accuracy, ammo cost
- `quotes.ts` — `TransitQuote[]` flavor quotes shown on transit splash (33% chance)
- `enemies.ts` — (not a separate file; enemy data lives in the mode config in `index.ts`)

---

## Engine Layer

The engine is **pure functions only** — no side effects, no React, no Supabase. Every function takes state and returns new state. This makes them straightforward to test.

### `engine/gameLoop.ts` — Phase Transitions

Controls the game's state machine. All major phase transitions live here.

| Function | What it does |
|---|---|
| `initializeGame(name, modeId)` | Creates the initial `GameState` with markets, opening log entries, and 2 seeded market events |
| `startTravel(state, dest)` | Phase: `settlement → traveling`. Sets `pendingDestination`, picks transit quote (33% chance), does NOT yet tick debt |
| `continueTravel(state)` | Phase: `traveling → event` or `traveling → settlement`. Applies interest tick, updates debt window, selects a travel event (or none). If no event, calls `completeTravel` directly |
| `completeTravel(state, dest)` | Arrives at destination. Increments turn, refreshes destination market, ticks market events, checks win condition (turn > maxTurns) |
| `resolveChemStash(state)` | Adds found chems to inventory (capped at capacity), then completes travel |
| `resolveBrotherhoodToll(state, pay)` | Pay → complete travel. Refuse or can't afford → `consumeTurnInPlace` (turn lost, no movement) |
| `resolveDebtCollector(state)` | Applies enforcement damage from `debtEnforcement[debtWarnings]`. Fatal damage → game over. Otherwise increments `debtWarnings` and completes travel |
| `startCombat(state)` | Calls `initiateCombat`, transitions to `combat` phase |
| `afterCombat(state, result)` | On victory/flee, checks if a second wave should spawn (danger ≥ 0.65, random). Otherwise → `combat_summary` phase. On death → `game_over` |
| `dismissCombatSummary(state)` | Calls `completeTravel` from the `combat_summary` phase |

**Two-phase travel design:** `startTravel` only sets the destination and shows the splash. `continueTravel` is where the actual mechanics happen (debt tick, event roll). This is intentional — the player sees the transit quote first, then clicks Continue to commit to the move.

### `engine/combat.ts` — Fight and Run

`initiateCombat(dangerLevel, modeConfig, roadEnemyWeights?, forcedTypeId?, forcedCount?)`:
- Picks one enemy type using weighted random selection (road `enemyWeights` override global weights)
- Count = `max(1, round(dangerLevel * 5))` unless forced
- Pre-rolls loot (`enemyLoot`) at combat start, awarded on victory
- Returns initial `CombatState` with phase `'player_choice'`

`resolveFight(player, combat, modeConfig)`:
- Player fires (1 shot, consumes `ammoPerShot`)
- Each guard fires (1 ammo each from shared pool)
- Surviving enemies attack; guards absorb `guardHealth` HP per guard before player takes damage
- Returns updated `{ player, combat }`

`resolveRun(player, combat, modeConfig)`:
- Run chance = `0.40 + guards * 0.10 - brahmin * 0.05`, clamped to [0.1, 0.9]
- Success: possibly lose a brahmin (30% chance if any owned), phase → `'fled'`
- Failure: take reduced damage (50% of enemy damage range), potentially die

### `engine/economy.ts` — Financial Operations

All pure functions returning `{ player, error? }` or `{ player, profit?, error? }`:

| Function | Notes |
|---|---|
| `applyTurnInterest(player, rate)` | Compounds debt, increments `ageOfDebt`, resets `debtPaidThisCycle` to 0 |
| `buyChems / sellChems` | Sell tracks P&L using `pricePaid` cost basis |
| `repayDebt` | Adds payment to `debtPaidThisCycle`, resets `debtWarnings` on full payoff |
| `addChemStash` | Capacity-aware free item add (stash finds, combat loot). `pricePaid = 0` for free items |
| `calculateFinalScore` | `caps + bank - debt` |
| `payBrotherhoodToll` | Returns `{ player, paid: boolean }` — `paid: false` if can't afford |

### `engine/travel.ts` — Roads and Events

`selectTravelEvent(road, player, modeConfig)` — called from `continueTravel`, two sequential rolls:
1. **Debt collector check** — fires when payment window is overdue (elapsed turns ≥ `debtWindowSize` without meeting 15% threshold) AND `rng() < debtCollectorProb`. Returns immediately if triggered; skips both rolls below.
2. **Combat roll** — `rng() < road.dangerLevel`. `dangerLevel` is the direct probability of a combat encounter; no scaling factor. Returns a `raider_ambush` event if triggered.
3. **Non-combat roll** — only reached when no ambush. `rng() < modeConfig.nonCombatEventProb` (0.30). Picks from the non-combat event pool (chem stash, wandering merchant, brahmin lost, checkpoint) filtered by `minDangerToTrigger`.

This means on a 0.60 road, 60% of trips trigger combat and 12% (0.40 × 0.30) trigger a non-combat event. Non-combat events are therefore naturally rarer on dangerous roads — the non-combat roll is only reached on the fraction of trips that avoided combat.

`buildEventPayload` for `wandering_merchant` randomly decides fence (buy from them, 35% chance) vs. desperate buyer (sell to them, 65% chance), with appropriate pricing.

`dropExcessInventory(player)` — called when brahmin count drops. Drops cheapest items first (by `pricePaid`) until within capacity.

### `engine/market.ts` — Market State

Markets are fully re-rolled on each arrival at a destination (`refreshMarket` = `initializeMarket`). Each chem has an independent availability roll per settlement per refresh.

`applyMarketEvents(market, events, settlementId)` — computed on demand; never stored. Active events multiply prices. `settlementId === null` on an event means it affects all settlements.

### `engine/rng.ts` — Randomness

All randomness goes through this module. Currently wraps `Math.random()`. To make the game deterministic/seedable for testing or replays, replace the `rng()` function with a seeded PRNG here — all callers automatically get the seeded version.

---

## State Management

### `src/store/gameStore.ts` — Zustand Game Store

**The `mutate` pattern** — every action uses this helper:
```ts
function mutate(updater: (state: GameState) => GameState) {
  const current = get().gameState
  if (!current) return
  const next = updater(current)
  set({ gameState: next })
  scheduleSave(next)
}
```
Engine functions return new state; `mutate` applies it and schedules a debounced Supabase save.

**Supabase sync** — `scheduleSave` debounces writes by 400ms. On game over, it also writes `status`, `final_score`, and `turns_reached` to the `games` table. The `state` column holds the full `GameState` as JSONB.

**`currentMarket(state)`** — computes the market with active events applied. Called inside `buy`/`sell` to get live prices. Never stored; always derived.

**Toast errors** — actions that fail (not enough caps, no stock, etc.) call `set({ toast: error })`. The toast auto-clears after 3 seconds in `Game.tsx` via a `useEffect`.

**`normalizeState(state)`** — old v1.0 saves have no `mode` field. This coerces them to `'commonwealth'` so `GAME_MODES[mode]` never fails with undefined.

**Save slot model** — one active game per mode per user. `startNewGame` archives any existing active game for that mode to `status: 'bankrupt'` before inserting the new one.

### `src/store/authStore.ts`

Thin wrapper around Supabase Auth. `initialize()` is called once at app startup in `App.tsx` to restore session from local storage and subscribe to auth state changes.

---

## UI Layer

### Desktop Layout (`src/pages/Game.tsx`)

Three-column layout:
- **Left** (w-52): `PlayerStats` — always visible
- **Center** (flex-1): Phase-driven main panel. Settlement tab bar (market/travel/services) shown when `phase === 'settlement'`. Travel splash, combat panel, event panel, and combat summary each replace the tab content during their phases.
- **Right** (w-64): `InventoryPanel` + `GameLog`, fixed height column

Settlement background image renders behind the center column at 52% opacity when at a settlement and not in a travel/combat phase.

**Phase rendering logic** in `Game.tsx`:
```ts
if (phase === 'traveling') return <TravelSplash />
if (phase === 'combat')    return <CombatPanel />
if (phase === 'combat_summary') return <CombatSummaryPanel />
if (phase === 'event')     return <EventPanel />
// else: settlement tabs
```

### Mobile Layout (`src/components/game/MobileGame.tsx`)

Self-contained 5-tab layout (stats, market, travel, pack, log). All settlement-level UI is re-implemented inline using a render-function pattern rather than importing the desktop panel components. See [Mobile vs Desktop Architecture](#mobile-vs-desktop-architecture) for the full breakdown of what's shared and what isn't.

When `isMobile` is true, `Game.tsx` renders only `<MobileGame />`.

### Phase-Specific Components

- **`EventPanel`** — reads `event.type` to decide which buttons to show (fight/run, pay/refuse/fight, etc.). Button labels and choices are wired to `gameStore.resolveEvent(choice)`.
- **`CombatPanel`** — shows enemy unit cards and fight/run buttons. Fight/run call `gameStore.fight()` / `gameStore.run()`.
- **`SettlementMap`** — SVG renderer. Node positions come from `mc.mapPositions` in the mode config. Danger bars shown on roads use the road's `dangerLevel` field.
- **`ServicesPanel`** — conditionally renders service blocks based on `settlement.hasDoctor`, `settlement.hasBank`, etc. Uses `mc` (mode config) for costs.

---

## Mobile vs Desktop Architecture

### How the split works

`useIsMobile()` (`src/hooks/useIsMobile.ts`) returns `true` when viewport width < 768px. `Game.tsx` checks this after the game-over guard and routes accordingly:

```
Game.tsx
├── phase === 'game_over'  →  GameOverScreen   (shared — same on both)
├── isMobile               →  <MobileGame />   (self-contained)
└── desktop                →  3-column layout  (individual panel components)
```

### Shared components

These five components are imported by **both** `Game.tsx` and `MobileGame.tsx`. They are "phase overlay" components — they replace the full main content area during their game phase, so the layout context doesn't matter:

| Component | Game phase | Notes |
|---|---|---|
| `CombatPanel` | `combat` | Fight/run buttons, enemy unit cards |
| `CombatSummaryPanel` | `combat_summary` | Victory/escape stats, count-up animations, XP |
| `EventPanel` | `event` | Raider ambush, chem stash, checkpoint, etc. |
| `TravelSplash` | `traveling` | Transit quote shown before event resolution |
| `SettlementMap` | settlement / travel tab | SVG map; desktop wraps it in `MapPanel`, mobile uses it directly |

`GameOverScreen` (defined inside `Game.tsx`) is also effectively shared — it renders before the `isMobile` check, so the same screen appears on both.

### Desktop-only components

These implement the 3-column desktop layout and are not used by `MobileGame.tsx`:

| Component | Location in layout | Notes |
|---|---|---|
| `PlayerStats` | Left column (w-52) | Always visible; shows HP, turn, XP, debt, equipment |
| `MarketPanel` | Center — market tab | Buy/sell table |
| `MapPanel` | Center — travel tab | Wraps `SettlementMap` + travel buttons |
| `ServicesPanel` | Center — services tab | Doctor, bank, guards, guns, armor |
| `InventoryPanel` | Right column | Current holdings with cost basis + price delta |
| `GameLog` | Right column | Append-only run log, scrollable |

### What MobileGame re-implements internally

`MobileGame.tsx` is a single large component (~650 lines) that re-implements all of the desktop-only panel logic inline as **render functions** (plain functions, not React components). This is by design — see hooks note below.

| Tab | Equivalent desktop component(s) |
|---|---|
| Stats | `PlayerStats` |
| Market | `MarketPanel` |
| Travel | `MapPanel` + `SettlementMap` + travel buttons |
| Pack | `InventoryPanel` |
| Log | `GameLog` |

Services (doctor, bank, guards, etc.) are accessible within the Travel tab on mobile rather than a dedicated tab.

Settlement background images are **not shown on mobile** — `MobileGame.tsx` does not render them.

### The render-function pattern and hooks rule

MobileGame tabs are implemented as plain functions called inline, not as React components:

```tsx
// Inside MobileGame() component
function renderStatsTab() {
  // This is NOT a React component — it's a plain function.
  // It can use variables from MobileGame's closure but CANNOT call hooks.
  return <div>...</div>
}

// All hooks are declared at the TOP of MobileGame():
const { flashKey: capsFlash } = useValueFlash(player.caps)
const { flashMap: invFlash }  = useMapFlash(player.inventory)
// ... then passed into render functions via closure
```

**Critical rule:** All `useValueFlash`, `useMapFlash`, and any other hooks must be declared unconditionally at the top of the `MobileGame` function body, not inside tab render functions. Calling hooks inside `renderStatsTab()` etc. violates the Rules of Hooks and will either throw at runtime or produce subtle bugs. If you need a new flash effect for a tab, add the hook call at the component top and access the result inside the render function via closure.

### When to add to shared vs. separate

| Scenario | What to do |
|---|---|
| New game phase (new `GamePhase` value) | Create a new shared component; import it in both `Game.tsx` and `MobileGame.tsx` |
| New settlement-level panel (desktop) | Create a component, add it to Game.tsx's tab bar; re-implement the same UI inline in MobileGame.tsx |
| New player stat or UI element | Add to `PlayerStats.tsx` for desktop AND to `renderStatsTab()` inside `MobileGame.tsx` |
| Bug fix in a shared component | Fix once — automatically applies to both |
| New service in ServicesPanel | Add to `ServicesPanel.tsx` AND to the services section in `MobileGame.tsx` |

---

## CSS Theme System

Tailwind color names (`bg-pip-bg`, `text-pip-green`, etc.) map to CSS custom properties. The custom properties are re-declared per `[data-mode]` attribute:

```css
:root,
[data-mode="commonwealth"]   { --pip-bg: #b89a52; --pip-green: #2c4a10; ... }
[data-mode="capital_wasteland"] { --pip-bg: #3d4f30; ... }
[data-mode="mojave_wasteland"]  { --pip-bg: #c8723a; ... }
```

`data-mode` is set on the outermost `<div>` in `Game.tsx` and `GameOverScreen`:
```tsx
<div data-mode={gameState.mode}>
```

This means every `text-pip-green` in any child component automatically adapts to the current mode's color palette. To add color variation for a new mode, add a new `[data-mode="new_mode_id"]` block in `src/index.css` and define all `--pip-*` variables.

**Price color encoding** (`src/utils/priceColor.ts`): positional encoding only — no red/green good/bad judgment. Five bands from cool blue (cheapest) to deep rust (most expensive), based on position within `[basePrice * (1 - variance), basePrice * (1 + variance)]`. Out-of-range prices (fence deals) clamp to the endpoint color.

---

## Backend / Supabase

### `games` table schema (migration 001)

```
id               uuid        PK
user_id          uuid        → auth.users
character_name   text        (1-30 chars)
state            jsonb       full GameState blob
status           text        'active' | 'won' | 'dead' | 'bankrupt'
final_score      integer     null until game over (caps + bank - debt)
current_location text        extracted from state for queries
is_traveling     boolean
mode             text        null for pre-v2 saves (migration 003)
turns_reached    integer     null until game over
created_at, updated_at
```

### RLS (migration 002)

Users can only read/write their own `status = 'active'` games. Migration 004 adds a separate policy allowing unauthenticated reads of finished games (`status IN ('won', 'dead')`) for the public leaderboard.

### Running migrations

Migrations are applied manually via the Supabase SQL editor or CLI (`supabase db push`). Name them sequentially: `005_your_change.sql`. Migrations are never rolled back — write forward-only changes.

### Environment variables

Create `.env.local` (copy `.env.example`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Key Patterns and Gotchas

**Game images are served locally.** Settlement images live in `public/assets/settlements/` and are referenced as `/assets/settlements/name.webp`. Chem images currently point to the Fandom CDN (`static.wikia.nocookie.net`), which may block cross-origin requests in some environments — if adding new chems, put images in `public/assets/chems/` instead.

**`tsc -b` for builds, not `--noEmit`.** The build script uses `tsc -b` (project references mode). Running `tsc --noEmit` for type-checking works but `tsc -b` is required for the actual build output.

**Market event prices vs. market base prices.** The stored `SettlementMarket.prices` are always the raw unadjusted prices. `applyMarketEvents()` is called at render time to get the effective price. When implementing buy/sell logic, always derive the market via `applyMarketEvents(rawMarket, activeEvents, location)` — never use `rawMarket.prices` directly for transactions. The `gameStore` does this in `currentMarket()`.

**`debtPaidThisCycle` snapshot order.** In `continueTravel`, the pre-tick payment value must be snapshotted *before* `applyTurnInterest` is called (which resets `debtPaidThisCycle` to 0). The window update logic runs *after* the tick using the snapshotted value. Getting this order wrong breaks payment window tracking.

**`normalizeState` on load.** Old saves don't have a `mode` field. Always run `normalizeState` after loading from Supabase. Already done in all `loadGame*` functions — don't add new load paths without it.

**Debt enforcement is window-based, not turn-based.** The collector fires when a full payment window (`debtWindowSize` turns) elapses without the player paying 15% of current debt. It does not fire on a specific turn number. The `debtEnforcement` array in `GameModeConfig` is keyed by `debtWarnings` count (escalating damage), not by turn age.

**Second-wave encounters.** After combat on a high-danger road (`dangerLevel >= 0.65`, i.e. the top tier after scaling), `afterCombat` may spawn a second wave. The second encounter event has `payload.isSecondEncounter = true`, which prevents a third wave from spawning.

**`consumeTurnInPlace`** — used when travel is aborted mid-road (can't afford toll, turns back from checkpoint). Increments the turn counter and ticks market events but leaves the player at their current location. This is distinct from completing travel.

**Guards in combat.** Guards absorb damage as a group: `floor(totalIncoming / guardHealth)` guards are consumed, absorbing that many × `guardHealth` HP. Guards also fire once each per round, consuming 1 ammo each from the shared gun ammo pool.

**`rngWeightedPick`** — used for enemy type selection and event selection. Items need a `weight: number` property. Weight 0 means never selected (used for `debt_collector` events, which are only triggered by the engine explicitly, never randomly).

**React hooks in MobileGame.tsx.** All `useValueFlash` and `useMapFlash` calls are at the top of the component, not inside tab render functions. If you add new flash effects for a tab, add the hook call at the component top and pass the result down via closure. Calling hooks conditionally or inside callbacks violates Rules of Hooks.

---

## How To: Add a New Chem

1. **Add to `src/data/chems.ts`:**
   ```ts
   my_chem: {
     id: 'my_chem',
     name: 'My Chem',
     basePrice: 130,
     priceVariance: 0.50,
     availability: 0.60,
     maxStock: 8,
     highPriceMsg: "...",
     lowPriceMsg: "...",
     description: "...",
     imageUrl: '/assets/chems/my_chem.webp',  // or null
   }
   ```

2. **Add to the relevant mode(s) in `src/data/modes/index.ts`:**
   ```ts
   availableChemIds: [...existingIds, 'my_chem']
   ```

3. **Add the image** (if any) to `public/assets/chems/`.

4. **Optionally add `msgOverrides`** for mode-specific flavor text.

5. **Optionally add to `lootChems`** on enemy types if you want it to drop from combat.

The chem will automatically appear in markets, inventory, and price displays. No other changes needed.

---

## How To: Add a New Game Mode

1. **Add the `GameModeId` union** in `src/types/game.ts`:
   ```ts
   export type GameModeId = 'commonwealth' | 'capital_wasteland' | 'mojave_wasteland' | 'my_region'
   ```

2. **Create a new subdirectory** `src/data/modes/my_region/` with:
   - `settlements.ts` — copy from `commonwealth/settlements.ts`, replace with your settlements/roads
   - `events.ts` — copy and customize (or keep the same)
   - `guns.ts` — copy and customize
   - `quotes.ts` — write flavor quotes
   - `index.ts` — barrel re-export (copy pattern from existing modes)

3. **Add the config to `src/data/modes/index.ts`:**
   ```ts
   const MY_REGION_MODE: GameModeConfig = {
     ...COMMONWEALTH_MODE,    // inherit defaults
     id: 'my_region',
     name: 'My Region',
     subtitle: 'Fallout: Somewhere',
     // override what differs
     interestRate: 0.07,
     settlements: MY_SETTLEMENTS,
     roads: MY_ROADS,
     ...
   }
   ```
   Then add it to `GAME_MODES`.

4. **Add CSS theme variables** in `src/index.css`:
   ```css
   [data-mode="my_region"] {
     --pip-bg: #...;
     --pip-green: #...;
     /* define all --pip-* variables */
   }
   ```

5. **Update `VALID_MODES`** in `src/store/gameStore.ts`:
   ```ts
   const VALID_MODES = new Set<GameModeId>(['commonwealth', 'capital_wasteland', 'mojave_wasteland', 'my_region'])
   ```

6. **Update `loadActiveGames`** in `gameStore.ts` — add `my_region: null` to the summaries initial state.

7. **Update `Home.tsx`** — add the mode to wherever mode selection UI is rendered.

8. **Add settlement images** to `public/assets/settlements/`.

---

## How To: Add a New Travel Event Type

1. **Add the type** to `TravelEventType` union in `src/types/game.ts`.

2. **Add a definition** to the mode's `events.ts` (`TRAVEL_EVENT_DEFS` array):
   ```ts
   {
     type: 'my_event',
     weight: 10,
     minDangerToTrigger: 0.20,
     title: "MY EVENT",
     description: "Flavor text shown in the event panel.",
   }
   ```

3. **Add payload building** in `buildEventPayload` in `engine/travel.ts` (switch case).

4. **Add resolution logic** in `gameStore.ts` in the `resolveEvent` switch:
   ```ts
   case 'my_event':
     return resolveMyEvent(state, choice)
   ```
   Add `resolveMyEvent` to `engine/gameLoop.ts`.

5. **Add UI** in `src/components/game/EventPanel.tsx` — a new case for the event type with appropriate buttons and descriptions.

---

## SVG Settlement Map

### How the map is rendered

`src/components/game/SettlementMap.tsx` renders a single inline `<svg>` with a fixed `viewBox="0 0 600 548"`. There is no image file — the map is drawn entirely from data at runtime.

The component receives `mc: GameModeConfig` and reads two things from it:
- `mc.roads` — the edge list, drawn as colored `<line>` elements
- `mc.mapPositions` — a `Record<string, MapNodePosition>` giving each settlement an `(x, y)` coordinate and a label anchor, used for the node circles and name text

**Visual layers (drawn in order):**
1. Parchment background rectangle (`#d8bf88`)
2. Fractal noise grain filter at 7% opacity (SVG `<feTurbulence>`)
3. Radial vignette gradient
4. Map title (`mc.mapTitle`) centered at top
5. All roads as `<line>` elements — adjacent roads are solid and bold; non-adjacent are dashed and dimmed
6. Settlement node circles + name labels + service icon row
7. Compass (N marker, top-right)

**Node appearance is driven by three states:**
- `isCurrent` — large amber circle (r=13) with pulsing outer ring animation
- `isAdj` — medium circle (r=9.5), clickable, calls `onTravel(id)` on click
- neither — small dim circle (r=6.5), not interactive

**Road color** is determined by `dangerLevel` alone (not by which mode you're in):
```
dangerLevel >= 0.50  →  dark red    (#8c1c1c)   — combat > 50% per trip
dangerLevel >= 0.33  →  amber       (#c47810)   — combat 33–50%
otherwise            →  muted green (#4a6a20)   — combat < 33%
```
The `DangerBars` indicator in TravelPanel and MobileGame uses `Math.round(level * 5)` bars; bars ≥ 3 shows red, bars ≥ 2 amber, below shows green — which aligns with the same thresholds.

**Service icons** (`✚ ¤ ⚙ ⚔`) are assembled from the settlement's boolean flags (`hasDoctor`, `hasBank`, `hasArmory`, `hasGuards`) and placed as a second text row below (or above) the settlement name, 10–11px further in the same direction as the label.

**Mobile vs. desktop sizing:** The same component handles both. On mobile, `compact={true}` scales the `viewBox` contents down by 0.58× using `width="100%"` on the SVG element and an explicit pixel height (~360px). On desktop the SVG fills its container with `className="absolute inset-0 w-full h-full"`.

---

### The coordinate system

The viewBox is **620 × 620**. All modes share a 6×6 grid of possible node positions with a **100px step**:

| Column | x |
|---|---|
| 1 | 60 |
| 2 | 160 |
| 3 | 260 |
| 4 | 360 |
| 5 | 460 |
| 6 | 560 |

| Row | y |
|---|---|
| 1 | 60 |
| 2 | 160 |
| 3 | 260 |
| 4 | 360 |
| 5 | 460 |
| 6 | 560 |

The viewBox has 60px of padding on all sides before/after the outermost grid positions. Not every cell needs a node — each mode currently uses 9 of the 36 cells, placed in columns/rows 2–5, leaving columns/rows 1 and 6 free for future expansion.

---

### `MapNodePosition` fields

```ts
interface MapNodePosition {
  x: number              // SVG x coordinate (node center)
  y: number              // SVG y coordinate (node center)
  labelAnchor: 'middle' | 'start' | 'end'  // SVG text-anchor
  labelDx: number        // horizontal offset of label text from (x, y)
  labelDy: number        // vertical offset of label text from (x, y)
}
```

The label anchoring convention used throughout all existing modes:

| Settlement position relative to nearby nodes | labelAnchor | labelDx | labelDy |
|---|---|---|---|
| Top row, isolated above | `'middle'` | 0 | -15 (above node) |
| Bottom row | `'middle'` | 0 | +16 (below node) |
| Leftmost column | `'end'` | -13 | ±4 (beside, left) |
| Rightmost column | `'start'` | +13 | ±4 (beside, right) |
| Middle, below-adjacent nodes | `'middle'` | 0 | +18 |

The sign of `labelDy` also controls where service icons appear: positive `labelDy` puts icons 11px further below; negative puts them 10px further above.

---

### Updating positions when settlements or roads change

**Adding or moving a settlement:**

1. Pick the grid cell — choose `x` and `y` from the grid values above (60, 160, 260, 360, 460, 560).
2. Decide label placement using the convention table above (avoid overlap with adjacent node labels).
3. Add or update the entry in `mc.mapPositions` in `src/data/modes/index.ts`.
4. Make sure the settlement's id exists in `mc.settlements` — nodes with no matching settlement are silently skipped.

**Removing a settlement:**

Delete its key from `mc.mapPositions` and from `mc.settlements`. Also remove or update any `Road` entries in `mc.roads` that reference its id. The SVG renderer skips any road whose `from` or `to` id has no position entry, so a missing position won't crash but will leave a dangling road hidden in the data.

**Adding a road:**

Add an entry to `mc.roads`. The renderer draws it automatically if both endpoint ids exist in `mc.mapPositions`. Choose `dangerLevel` to control road color and event frequency. Optionally set `enemyWeights` to bias which enemy types appear on that specific road:
```ts
{
  id: 'my_road',
  name: 'My Road',
  from: 'settlement_a',
  to: 'settlement_b',
  dangerLevel: 0.55,
  description: "...",
  enemyWeights: { raider: 3, super_mutant: 1 },  // raiders 3× more likely
}
```

**Rearranging the whole layout (new mode or major redesign):**

There is no generation script — the positions are set manually. The workflow:

1. Sketch your settlement graph on paper or in a drawing tool. Aim for a planar graph where roads don't cross awkwardly (they will if nodes are far apart).
2. Map each node to a grid cell. With 9 nodes and a 6×6 grid you have 27 unused cells — use them as gaps to spread geographically distant settlements apart.
3. Enter the `x`, `y`, `labelAnchor`, `labelDx`, `labelDy` values into `mapPositions`.
4. Run `npm run dev` and open the Travel tab. Iterate on label positions to avoid overlaps.

**Label overlap debugging tips:**
- If two labels collide, the most common fix is changing one node's `labelAnchor` from `'middle'` to `'start'` or `'end'`, and adjusting `labelDx` to ±13.
- For nodes on the same row at adjacent x positions (e.g. x=225 and x=355), center labels (`'middle'`, `labelDy ± 15`) work well. For nodes at the same y on adjacent columns, side labels (`'start'`/`'end'`, `labelDx ±13`, `labelDy ±4`) avoid collisions.
- The service icon row is placed at `labelDy + 11` (or `labelDy - 10` if the label is above the node), so leave extra vertical clearance below bottom-row nodes if they have many services.

---

## Adding Game Images

### Settlement background images

Settlement backgrounds are rendered in the desktop game view as a full-bleed cover behind the center panel at **52% opacity**, with the mode's `--pip-bg` colour showing through underneath. A gradient overlay (`transparent → pip-bg`) covers the bottom ~25% of the image to keep the parchment panels legible.

**Where images are used:** `Game.tsx` only (desktop layout). The mobile layout (`MobileGame.tsx`) does not render settlement backgrounds. Images are not shown during travel, combat, or event phases — only when `phase === 'settlement'` and the settlement has a non-null `imageUrl`.

**Where to put files:** `public/assets/settlements/`

**Naming:** match the settlement id — e.g. `diamond_city.webp`, `rivet_city.webp`.

**How to register:** set `imageUrl` in the settlement's definition in the mode's `settlements.ts`:
```ts
imageUrl: '/assets/settlements/diamond_city.webp',
```
Set `imageUrl: null` to show no background (the plain `pip-bg` colour shows instead).

#### Format and resolution

| Property | Recommendation |
|---|---|
| Format | **WebP** — best quality-to-size ratio, supported by all modern browsers. JPEG is an acceptable fallback for photographic content. Avoid PNG (too large for photos). |
| Dimensions | **1200 × 900 px** is a good target. The panel is roughly 800 px wide at 1280px viewport and expands to ~1000 px at 1920px. `object-cover` fills the space and crops edges, so there is no strict requirement, but going narrower than the display width causes upscaling. |
| Aspect ratio | Landscape works best. The panel is typically taller than it is wide on a standard 16:9 monitor, so a **4:3** ratio (e.g. 1200 × 900) fits well without excessive cropping. Avoid portrait-oriented images. |
| File size | Target **100–250 KB** per image. At 52% opacity the image doesn't need to be razor-sharp; 80–85% WebP quality is indistinguishable from higher settings here. |
| Content placement | `object-cover` anchors to the centre, so keep the focal subject centred. The **bottom 25% of the image** is heavily darkened by the gradient overlay — avoid placing important content there. |

#### Quick resize/export recipe (ImageMagick)

```bash
# Convert and resize to 1200px wide, preserve aspect ratio, ~85% quality
magick input.jpg -resize 1200x -quality 85 public/assets/settlements/my_settlement.webp
```

If ImageMagick is not available, [Squoosh](https://squoosh.app) (browser-based) works well: resize to 1200 × 900, export as WebP at 80% quality.

---

### Chem item images

Chem images appear in two places:
- **Market table** (`MarketPanel.tsx`): `24 × 24 px` (`w-6 h-6 object-contain`)
- **Inventory panel** (`InventoryPanel.tsx`): `32 × 32 px` (`w-8 h-8 object-contain`)

`object-contain` is used in both cases, so the image is letterboxed rather than cropped — a square image with some padding works best.

**Where to put files:** `public/assets/chems/`

**Naming:** match the chem id — e.g. `jet.png`, `psycho.webp`.

**How to register:** set `imageUrl` in the chem's definition in `src/data/chems.ts`:
```ts
imageUrl: '/assets/chems/jet.png',
```
Set `imageUrl: null` to show a `?` placeholder in the market table and nothing in inventory.

#### Format and resolution

| Property | Recommendation |
|---|---|
| Format | **PNG** with transparency is ideal — item icons typically have transparent backgrounds. WebP with alpha is also fine. Avoid JPEG (no transparency). |
| Source size | Display is 24–32 px, so a source image of **64 × 64** or **128 × 128 px** is more than sufficient. Higher resolution adds file size with no visible benefit. |
| Background | Transparent preferred. If sourcing from the Fallout wiki, the icons are typically 56 × 56 px transparent PNGs — these can be used directly without resizing. |
| File size | Should be well under **20 KB** per icon at these dimensions. |

#### Sourcing images

The Fandom wiki (`fallout.fandom.com`) hosts item icons but **blocks cross-origin image requests** — using a Fandom CDN URL directly in the code will result in broken images in the browser. Always download the image and serve it from `public/assets/chems/` instead.

To find a wiki icon: search the item on the Fallout wiki, open the item's infobox image in a new tab, right-click → save. The direct image URL typically looks like:
```
https://static.wikia.nocookie.net/fallout/images/x/xx/Fallout4_Jet.png
```

Save it to `public/assets/chems/jet.png` and update `imageUrl` in `chems.ts` to `/assets/chems/jet.png`.

---

## Running and Building

```bash
npm run dev        # dev server (Vite, hot reload)
npm run build      # type-check (tsc -b) then Vite build → dist/
npm run test       # Vitest unit tests (one-shot)
npm run test:watch # Vitest watch mode
npm run lint       # ESLint
npm run preview    # serve the dist/ build locally
```

Tests live in `src/engine/__tests__/`. The engine is pure functions so all tests run in jsdom without a browser. Tests import engine functions directly and verify state transitions.
