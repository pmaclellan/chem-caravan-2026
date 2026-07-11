import { useState, useEffect, useCallback } from 'react'
import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { useCombatAnimation } from '../../hooks/useCombatAnimation'
import EnemyUnitCard from './EnemyUnitCard'
import GuardUnitCard from './GuardUnitCard'
import GuardClassIcon from './guardClassIcons'
import PlayerCaravanCard from './PlayerCaravanCard'
import MountCaravanCard from './MountCaravanCard'
import BrahminCounter from './BrahminCounter'
import { findBuff } from './buffInfo'
import TamingMinigame from './TamingMinigame'
import { TAMEABLE_ENEMY_IDS } from '../../data/mounts'
import { CHEMS } from '../../data/chems'
import { GUARD_CLASSES } from '../../data/guardClasses'
import { runEscapeChance } from '../../engine/tuning'
import { chemUseCap } from '../../engine/combat'

const COMBAT_CHEM_IDS = ['stimpak', 'jet', 'ultrajet'] as const
type CombatChemId = typeof COMBAT_CHEM_IDS[number]

const CHEM_COLOR: Record<CombatChemId, string> = {
  stimpak: 'var(--pip-green)',
  jet: 'var(--pip-amber)',
  ultrajet: 'var(--pip-blue)',
}

// Cross for the heal, the same bolt used on BuffBadge for the two accuracy chems —
// one glyph per effect, so the badge that later appears on a buffed unit visually
// traces back to the chem that caused it.
function ChemIcon({ chemId, size = 13 }: { chemId: CombatChemId; size?: number }) {
  const color = CHEM_COLOR[chemId]
  if (chemId === 'stimpak') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
        <path d="M11 3h2v7h7v2h-7v9h-2v-9H4v-2h7z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  )
}

interface ChemTrayProps {
  player: PlayerState
  combat: CombatState
  armedChem: CombatChemId | null
  setArmedChem: (chemId: CombatChemId | null) => void
}

// Chem tray only — arming a chem here is step one of a two-step flow: click a chem, then
// click a protector card above to apply it. No separate target picker lives in this panel.
function ChemTray({ player, combat, armedChem, setArmedChem }: ChemTrayProps) {
  const owned = COMBAT_CHEM_IDS.filter(id => (player.inventory[id]?.quantity ?? 0) > 0)
  if (owned.length === 0) return null

  const cap = chemUseCap(player)
  const usesRemaining = cap - combat.chemUsesThisRound
  const exhausted = usesRemaining <= 0

  return (
    <div className="border border-pip-border rounded p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="pip-label">Chems</div>
        <div className="text-[10px] font-mono text-pip-green-dim">{combat.chemUsesThisRound} / {cap} used this round</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {owned.map(chemId => {
          const chem = CHEMS[chemId]
          const qty = player.inventory[chemId]?.quantity ?? 0
          const isArmed = armedChem === chemId
          return (
            <button
              key={chemId}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border font-mono transition-colors ${!isArmed ? 'hover:bg-pip-border-dim' : ''}`}
              disabled={exhausted}
              style={{
                borderColor: isArmed ? CHEM_COLOR[chemId] : 'var(--pip-border)',
                backgroundColor: isArmed ? 'var(--pip-border-dim)' : undefined,
                opacity: exhausted ? 0.5 : 1,
              }}
              onClick={() => setArmedChem(isArmed ? null : chemId)}
            >
              <ChemIcon chemId={chemId} />
              <span className="text-pip-green-dim">{chem.name} × {qty}</span>
            </button>
          )
        })}
      </div>

      {armedChem && !exhausted && (
        <div className="mt-2 text-[10px] font-mono text-pip-amber flex items-center gap-1">
          <ChemIcon chemId={armedChem} size={10} /> Click a glowing protector above to apply {CHEMS[armedChem].name}
        </div>
      )}

      {exhausted && (
        <div className="mt-2 text-[10px] text-pip-amber">No treatments remaining this round.</div>
      )}
    </div>
  )
}

export const PA_GUARD_ICON = (
  <svg viewBox="0 0 100 100" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
    <g transform="translate(0,100) scale(0.1,-0.1)">
      <path d="M781 976 c-20 -21 -26 -23 -42 -13 -16 10 -24 7 -51 -20 -26 -27 -29 -34 -19 -47 18 -22 4 -38 -28 -31 -21 4 -33 -1 -55 -24 -25 -26 -27 -33 -16 -46 12 -14 2 -27 -70 -100 -83 -84 -85 -85 -125 -78 -32 4 -54 19 -111 74 -40 38 -77 69 -84 69 -19 0 -54 -21 -72 -44 -32 -38 -22 -64 52 -140 38 -40 70 -80 70 -89 0 -15 -44 -57 -60 -57 -4 0 -16 17 -25 37 -23 50 -44 73 -66 73 -29 0 -79 -49 -79 -77 0 -27 36 -93 50 -93 5 0 14 -9 20 -20 9 -16 7 -26 -9 -47 -39 -48 -30 -68 82 -180 133 -133 129 -133 256 -8 63 61 105 95 119 95 28 0 108 77 117 112 4 17 1 39 -9 60 l-17 32 82 82 c70 70 86 82 108 78 37 -8 81 38 64 66 -17 26 9 49 33 30 13 -11 20 -9 47 18 26 27 30 35 20 50 -9 14 -6 22 15 45 l26 27 -94 95 c-52 52 -97 95 -101 95 -3 0 -16 -11 -28 -24z m48 -40 c9 -10 8 -16 -4 -26 -21 -17 -51 6 -34 26 6 8 15 14 19 14 4 0 13 -6 19 -14z m85 -215 c-6 -7 -194 181 -194 194 0 5 45 -35 100 -90 54 -54 97 -101 94 -104z m-29 159 c4 -6 1 -17 -5 -26 -10 -11 -16 -12 -26 -3 -11 9 -11 15 -3 25 14 17 25 18 34 4z m-156 -44 c9 -10 8 -16 -4 -26 -19 -16 -41 1 -32 24 8 20 21 20 36 2z m217 -35 c-9 -14 -33 -14 -41 -1 -4 6 -1 18 6 26 11 13 14 13 27 0 8 -8 11 -19 8 -25z m-216 -76 c52 -52 91 -98 87 -102 -8 -7 -197 175 -197 189 0 19 21 2 110 -87z m55 55 c4 -6 1 -17 -5 -26 -10 -11 -16 -12 -26 -3 -11 9 -11 15 -3 25 14 17 25 18 34 4z m-157 -43 c9 -10 -9 -33 -77 -101 -78 -78 -89 -85 -101 -71 -12 14 -3 27 71 101 46 46 86 84 90 84 4 0 11 -6 17 -13z m218 -36 c-9 -14 -33 -14 -41 -1 -4 6 -1 18 6 26 11 13 14 13 27 0 8 -8 11 -19 8 -25z m-608 -44 l63 -63 -26 -24 -25 -24 -60 59 c-33 33 -60 64 -60 69 0 11 30 46 39 46 4 0 35 -28 69 -63z m449 17 c2 -5 -35 -47 -82 -94 -67 -67 -87 -82 -97 -72 -10 10 5 30 72 97 79 80 99 93 107 69z m-19 -151 c-76 -76 -89 -85 -103 -73 -14 12 -7 23 72 102 78 78 89 86 103 73 13 -14 5 -25 -72 -102z m-176 -51 c59 -60 108 -116 108 -125 0 -10 -16 -35 -36 -57 -57 -63 -72 -58 -190 63 -56 56 -104 110 -107 120 -8 23 67 107 96 107 12 0 62 -42 129 -108z m-392 -7 c0 -8 11 -27 25 -43 24 -28 24 -30 6 -46 -17 -16 -20 -14 -55 24 -41 45 -43 56 -19 82 12 14 19 15 30 7 7 -6 13 -17 13 -24z m268 -322 c-46 -46 -89 -83 -97 -83 -18 0 -179 157 -187 183 -5 15 13 38 77 103 l84 84 102 -102 103 -103 -82 -82z"/>
    </g>
  </svg>
)

interface Props { player: PlayerState; combat: CombatState }

export default function CombatPanel({ player, combat }: Props) {
  const {
    fight, run, completeCombatAnim, openTamingMinigame, completeTame, abandonTame, useAntivenom,
    useStimpakInCombat, useJetInCombat, useUltrajetInCombat,
  } = useGameStore()
  const combatAnimSteps    = useGameStore(s => s.combatAnimSteps)
  const showTamingMinigame = useGameStore(s => s.showTamingMinigame)
  const gameType = useGameStore(s => s.gameState?.gameType ?? 'standard')

  const [armedChem, setArmedChem] = useState<CombatChemId | null>(null)
  const [showCombatInfo, setShowCombatInfo] = useState(false)

  // Once this round's treatment budget is used up, an armed chem can't stay armed for a target we'll never reach.
  useEffect(() => {
    if (combat.chemUsesThisRound >= chemUseCap(player)) setArmedChem(null)
  }, [combat.chemUsesThisRound, player])

  // Esc dismisses the combat-details modal (backdrop click already handles tap-anywhere).
  useEffect(() => {
    if (!showCombatInfo) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCombatInfo(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCombatInfo])

  const chemActionFor: Record<CombatChemId, (kind: 'player' | 'guard' | 'pa_guard', id: string) => void> = {
    stimpak: useStimpakInCombat,
    jet: useJetInCombat,
    ultrajet: useUltrajetInCombat,
  }

  const applyArmedChemTo = (kind: 'player' | 'guard' | 'pa_guard', id: string) => {
    if (!armedChem) return
    chemActionFor[armedChem](kind, id)
    setArmedChem(null)
  }

  // A unit is a valid click target while a chem is armed, alive, and — for Stimpak
  // specifically — not already at full health (a wasted use of the 1-per-round cap).
  const isValidChemTarget = (kind: 'player' | 'guard' | 'pa_guard', id: string): boolean => {
    if (!armedChem) return false
    if (kind === 'player') return armedChem !== 'stimpak' || player.health < player.maxHealth
    const roster = kind === 'guard' ? player.guards : player.paGuards
    const unit = roster.find(g => g.id === id)
    if (!unit || unit.dead) return false
    return armedChem !== 'stimpak' || unit.health < unit.maxHealth
  }

  const aliveGuardCount   = player.guards.filter(g => !g.dead).length
  const alivePAGuardCount = player.paGuards.filter(g => !g.dead).length

  const isResolved  = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const isResolving = combat.phase === 'resolving'
  const gunCooldown = player.gun?.cooldownRemaining ?? 0
  const hasGuards   = aliveGuardCount > 0 || alivePAGuardCount > 0
  const hasMount    = !!player.mount
  // Distinct from power armor GUARDS — this is whether the player themself is wearing a suit
  const paLocked    = !!player.gun?.requiresPowerArmor && player.armor?.id !== 'power_armor'
  const gunCanFire  = !!player.gun && !paLocked && (player.gun.ammo > 0 || gunCooldown > 0)
  const canFight    = (gunCanFire || hasGuards || hasMount) && !isResolving

  const runChancePct = Math.round(runEscapeChance(aliveGuardCount, alivePAGuardCount, player.brahmin) * 100)

  const aliveEnemies = combat.enemies.filter(e => !e.dead)
  const soloAlive    = aliveEnemies.length === 1 ? aliveEnemies[0] : null
  const isTameableEnemy = soloAlive ? TAMEABLE_ENEMY_IDS.has(soloAlive.typeId) : false
  const soloCurrentHP   = soloAlive ? soloAlive.health : 0
  const canTame = gameType === 'free_play' && isTameableEnemy && !!player.tamingTool && player.hasSaddle && !player.mount && !isResolving

  const initialMountHealth = player.mount?.health ?? 0

  // Real-time lines delivered during the current animation round.
  // combat.log already accumulates across rounds, so we only need to augment
  // it with in-flight messages while an animation is playing.
  const [animLines, setAnimLines] = useState<string[]>([])

  // Clear animLines both when a new fight starts and when animation finishes
  // (at which point combat.log has been committed with everything).
  useEffect(() => { setAnimLines([]) }, [combatAnimSteps])

  const onLogLine = useCallback((line: string) => {
    setAnimLines(prev => [...prev, line])
  }, [])

  const anim = useCombatAnimation(
    combatAnimSteps,
    combat.enemies,
    player.guards,
    player.paGuards,
    player.health,
    player.armor?.armorPoints ?? 0,
    initialMountHealth,
    player.gun?.ammo ?? 0,
    gunCooldown,
    completeCombatAnim,
    onLogLine,
  )

  // Reload badge/dim state for the "YOU" card — lags behind the raw cooldown value while
  // animating so it flips in sync with this shot's own fire animation, not the instant the
  // round resolves (which can visually precede the shot animation by a beat).
  const displayGunCooldown = anim.isAnimating ? anim.displayGunCooldown : gunCooldown

  // Newest message at top — reverse after building the full list.
  // During animation: augment committed log with real-time lines.
  const displayLog = [...(
    anim.isAnimating ? [...combat.log, ...animLines] : combat.log
  )].reverse()

  // Enemy display: animated health during sequence, real health otherwise
  const displayEnemies = anim.isAnimating
    ? combat.enemies.map(e => {
        const h = anim.displayEnemyHealth[e.id] ?? e.health
        return { ...e, health: h, dead: h <= 0 }
      })
    : combat.enemies

  // Mount health for display during animation
  const displayMountHp = anim.isAnimating ? anim.displayMountHealth : (player.mount?.health ?? 0)
  const mountIsDead    = anim.isAnimating ? anim.mountDied : (player.mount ? player.mount.health <= 0 : false)

  // Player HP/AP bars animate down during retaliation, snap to real values after
  const displayHealth = anim.isAnimating ? anim.displayPlayerHealth : player.health
  const displayAP     = anim.isAnimating ? anim.displayPlayerAP     : (player.armor?.armorPoints ?? 0)

  // Rendered as one flat wrapped row, in shooting order (matches resolveFight()'s
  // firing sequence: player -> guards -> PA guards -> mount), brahmin trailing since
  // they never fight. Note this is NOT the same as who draws enemy fire — see the
  // combat-details popover for the actual (weighted-random) targeting rule.
  const renderCaravan = () => (
    <div className="flex gap-2 flex-wrap">
      {/* Player card */}
      <PlayerCaravanCard
        health={displayHealth}
        maxHealth={player.maxHealth}
        armorPoints={displayAP}
        maxArmorPoints={player.armor?.maxArmorPoints}
        fireFlashKey={anim.playerFireKey}
        damageFlashKey={anim.playerDamageKey}
        dodgeFlashKey={anim.playerDodgeKey}
        buff={findBuff(combat.activeBuffs, 'player', 'player')}
        reloadRoundsRemaining={displayGunCooldown}
        selectable={isValidChemTarget('player', 'player')}
        selectColor={armedChem ? CHEM_COLOR[armedChem] : undefined}
        onSelect={() => applyArmedChemTo('player', 'player')}
      />

      {player.guards.map(g => {
        const displayGuardHp = anim.isAnimating ? (anim.displayGuardHealth[g.id] ?? g.health) : g.health
        const displayUnit = { ...g, health: displayGuardHp, dead: g.dead || displayGuardHp <= 0 }
        const selectable = isValidChemTarget('guard', g.id)
        // Lags behind the raw cooldown value while animating so the reload badge flips
        // in sync with this guard's own shot, not the instant the round resolves.
        const displayGuardCooldown = anim.isAnimating ? (anim.displayGuardCooldown[g.id] ?? g.cooldownRemaining ?? 0) : (g.cooldownRemaining ?? 0)
        return (
          <GuardUnitCard
            key={g.id}
            unit={displayUnit}
            label={GUARD_CLASSES[g.classId].name.toUpperCase()}
            color="var(--pip-green)"
            icon={<GuardClassIcon classId={g.classId} color="var(--pip-green)" />}
            fireFlashKey={anim.guardFireKeys[g.id] ?? 0}
            damageFlashKey={anim.guardDamageKeys[g.id] ?? 0}
            dodgeFlashKey={anim.guardDodgeKeys[g.id] ?? 0}
            buff={findBuff(combat.activeBuffs, 'guard', g.id)}
            reloadRoundsRemaining={displayGuardCooldown}
            selectable={selectable}
            selectColor={armedChem ? CHEM_COLOR[armedChem] : undefined}
            onSelect={() => applyArmedChemTo('guard', g.id)}
          />
        )
      })}

      {player.paGuards.map(g => {
        const displayGuardHp = anim.isAnimating ? (anim.displayPAGuardHealth[g.id] ?? g.health) : g.health
        const displayGuardAp = anim.isAnimating ? (anim.displayPAGuardArmor[g.id] ?? g.armorPoints) : g.armorPoints
        const displayUnit = { ...g, health: displayGuardHp, dead: g.dead || displayGuardHp <= 0 }
        const selectable = isValidChemTarget('pa_guard', g.id)
        return (
          <GuardUnitCard
            key={g.id}
            unit={displayUnit}
            label="PA"
            color="var(--pip-blue)"
            icon={PA_GUARD_ICON}
            fireFlashKey={anim.guardFireKeys[g.id] ?? 0}
            damageFlashKey={anim.guardDamageKeys[g.id] ?? 0}
            dodgeFlashKey={anim.guardDodgeKeys[g.id] ?? 0}
            buff={findBuff(combat.activeBuffs, 'pa_guard', g.id)}
            armorPoints={displayGuardAp}
            maxArmorPoints={g.maxArmorPoints}
            selectable={selectable}
            selectColor={armedChem ? CHEM_COLOR[armedChem] : undefined}
            onSelect={() => applyArmedChemTo('pa_guard', g.id)}
          />
        )
      })}

      {/* Mount card */}
      {player.mount && (
        <MountCaravanCard
          creatureTypeId={player.mount.creatureTypeId}
          health={displayMountHp}
          maxHealth={player.mount.maxHealth}
          dead={mountIsDead}
          fireFlashKey={anim.mountFireKey}
          damageFlashKey={anim.mountDamageKey}
          dodgeFlashKey={anim.mountDodgeKey}
        />
      )}

      <BrahminCounter count={player.brahmin} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-center justify-between border-b border-pip-red pb-2">
        <div className="text-pip-red font-display text-3xl">
          !! COMBAT !!
        </div>
        <button
          className="w-6 h-6 rounded-full border border-pip-red text-pip-red font-display text-sm flex items-center justify-center leading-none hover:bg-pip-red hover:text-pip-bg-light transition-colors flex-shrink-0"
          onClick={() => setShowCombatInfo(v => !v)}
          aria-label="Combat details"
          aria-expanded={showCombatInfo}
        >
          ?
        </button>
      </div>

      {showCombatInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowCombatInfo(false)}
        >
          <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg) 80%, transparent)' }} />
          <div
            className="relative pip-panel max-w-md w-full text-xs leading-relaxed space-y-2 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="pip-section-title">Combat Details</div>
            <div><span className="font-bold text-pip-green-dim">Shooting Order:</span> You → Guards → PA Guards → Mount (left to right in Caravan), then surviving enemies retaliate.</div>
            <div><span className="font-bold text-pip-green-dim">Targeting:</span> enemies pick a random target each attack, weighted toward whoever draws more fire — PA guards and your mount draw the most attention, guards draw more than you.</div>
            <div style={{ color: 'var(--pip-green)' }}><span className="font-bold">Guards:</span> take partial damage per hit and carry wounds into future rounds — heal free at a settlement doctor.</div>
            <div style={{ color: 'var(--pip-blue)' }}><span className="font-bold">PA Guards:</span> also carry Armor Points that absorb damage before health — repaired free at a settlement armory.</div>
            <div style={{ color: 'var(--pip-amber)' }}><span className="font-bold">Brahmin:</span> don't fight — each one costs 12% escape chance, plus a 30% chance to bolt if you flee.</div>
            <div className="pt-1 border-t border-pip-border-dim"><span className="font-bold text-pip-green-dim">Chems:</span> click one below, then click a target — free action, doesn't cost your turn.</div>
            <div>
              <span className="font-bold" style={{ color: 'var(--pip-green)' }}>Stimpak</span> heals 25 HP.{' '}
              <span className="font-bold" style={{ color: 'var(--pip-amber)' }}>Jet</span> cuts miss chance by 25% for 2 rounds (70% acc → 77.5%).{' '}
              <span className="font-bold" style={{ color: 'var(--pip-blue)' }}>Ultrajet</span> cuts miss chance by 50% (70% acc → 85%).
            </div>
            <div>1 chem use per round, +1 for each living Medic guard in your squad.</div>
          </div>
        </div>
      )}

      {/* Enemy unit row */}
      <div className="border border-pip-border rounded p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-red) 5%, transparent)' }}>
        <div className="pip-label mb-2">Enemies</div>
        <div className="flex gap-3 flex-wrap">
          {displayEnemies.map(unit => {
            const animEntry = anim.enemyAnimInfo[unit.id]
            // Key change causes EnemyUnitCard to remount → CSS animation restarts cleanly
            const cardKey = anim.isAnimating && animEntry
              ? `${unit.id}-${animEntry.key}`
              : unit.id
            return (
              <EnemyUnitCard
                key={cardKey}
                unit={unit}
                flashKey={anim.enemyHitKeys[unit.id] ?? 0}
                isHit={anim.isAnimating && animEntry?.type === 'hit'}
                isDodge={anim.isAnimating && animEntry?.type === 'miss'}
                isAttacking={anim.isAnimating && animEntry?.type === 'attack'}
              />
            )
          })}
        </div>
      </div>

      {!isResolved && (
        <div className="flex gap-3">
          <button
            className="flex-1 rounded border border-pip-red font-display text-sm leading-snug px-4 py-1 transition-colors duration-100 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--pip-red)', color: 'var(--pip-bg-light)' }}
            disabled={!canFight}
            onClick={fight}
            title={paLocked ? `${player.gun!.name} requires YOU to be wearing Power Armor — not the same as hiring power armor guards` : undefined}
          >
            {isResolving
              ? 'FIGHTING...'
              : paLocked
                ? `${player.gun!.name} needs YOU in Power Armor`
                : gunCooldown > 0
                  ? `RELOADING — ${gunCooldown} turn${gunCooldown > 1 ? 's' : ''} left`
                  : gunCanFire
                    ? `FIGHT — ${player.gun!.name} (${player.gun!.ammo} ammo)`
                    : canFight
                      ? 'FIGHT — Guards only'
                      : 'NO GUN / NO AMMO'}
          </button>
          {canTame && (
            <button className="pip-btn-amber rounded" onClick={openTamingMinigame} style={{ flexShrink: 0, fontSize: '0.9rem', padding: '2px 12px' }}>
              TAME
            </button>
          )}
          <button className="pip-btn-amber flex-1 rounded text-sm leading-snug" disabled={isResolving} onClick={run}>
            RUN — {runChancePct}% chance
          </button>
        </div>
      )}

      {isResolved && (
        <div className={`font-display text-2xl text-center ${
          combat.phase === 'won'  ? 'text-pip-amber' :
          combat.phase === 'fled' ? 'text-pip-green' : 'text-pip-red'
        }`}>
          {combat.phase === 'won' ? 'VICTORY' : combat.phase === 'fled' ? 'ESCAPED' : 'DEFEATED'}
        </div>
      )}

      {!isResolved && <ChemTray player={player} combat={combat} armedChem={armedChem} setArmedChem={setArmedChem} />}

      {/* Caravan — flat row in shooting order (you, guards, PA guards, mount, brahmin) */}
      {(player.guards.length > 0 || player.paGuards.length > 0 || player.brahmin > 0) && (
        <div className="border border-pip-border rounded p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-green) 5%, transparent)' }}>
          <div className="pip-label mb-2">Caravan</div>
          {renderCaravan()}
        </div>
      )}

      {combat.playerVenomed && !isResolved && (
        <div className="border border-red-500 px-2 py-1 rounded text-xs flex items-center justify-between gap-2">
          <span className="text-red-400 font-bold">VENOMED — Accuracy -30%, -5 HP/round</span>
          {(player.inventory['antivenom']?.quantity ?? 0) > 0 && (
            <button className="pip-btn text-xs py-0.5 px-2 shrink-0" onClick={useAntivenom}>USE ANTIVENOM</button>
          )}
        </div>
      )}

      {/* Combat log — fully expanded, no internal scroll cap */}
      <div className="border border-pip-border p-3 rounded bg-pip-border-dim text-xs font-mono space-y-1">
        {displayLog.map((line, i) => (
          <div
            key={i}
            className={
              line.includes('dead') || line.includes('defeated') ? 'text-pip-amber' :
              line.includes('killed') || line.includes('hit you') || line.includes('flee') || line.includes('Missed') ? 'text-pip-red' :
              line.includes('armor absorbs') || line.includes('Armor absorb') ? 'text-pip-blue' :
              line.includes('Hit') ? 'text-pip-green-mid' :
              'text-pip-green'
            }
          >
            &gt; {line}
          </div>
        ))}
      </div>

      {/* Taming mini-game overlay */}
      {showTamingMinigame && player.tamingTool && soloAlive && (
        <TamingMinigame
          tool={player.tamingTool}
          creatureName={soloAlive.name}
          creatureTypeId={soloAlive.typeId}
          currentHP={soloCurrentHP}
          onSuccess={completeTame}
          onAbandon={abandonTame}
        />
      )}
    </div>
  )
}
