import { useState, useEffect, useCallback } from 'react'
import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { useCombatAnimation } from '../../hooks/useCombatAnimation'
import { FlashOverlay } from '../ui/FlashOverlay'
import EnemyUnitCard from './EnemyUnitCard'
import GuardUnitCard from './GuardUnitCard'
import GuardClassIcon from './guardClassIcons'
import BuffBadge from './BuffBadge'
import { findBuff } from './buffInfo'
import TamingMinigame from './TamingMinigame'
import { ENEMY_SVGS, MOUNT_ICONS } from './enemySvgs'
import { TAMEABLE_ENEMY_IDS } from '../../data/mounts'
import { CHEMS } from '../../data/chems'
import { GUARD_CLASSES } from '../../data/guardClasses'
import { runEscapeChance } from '../../engine/tuning'
import { chemUseCap } from '../../engine/combat'

const KEYFRAMES = `
  @keyframes mountFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 18px var(--pip-amber), inset 0 0 10px rgba(196,80,26,0.45); transform: scale(1.14); }
    65%  { opacity: 0.7; box-shadow: 0 0 10px var(--pip-amber); transform: scale(1.05); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes playerCardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 16px var(--pip-amber), inset 0 0 8px rgba(196,100,26,0.4); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 8px var(--pip-amber); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes allyDodge {
    0%   { transform: translateX(0);    }
    30%  { transform: translateX(10px); }
    65%  { transform: translateX(-2px); }
    85%  { transform: translateX(1px);  }
    100% { transform: translateX(0);    }
  }
  @keyframes guardCardSelectablePulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--select-color); }
    50%      { box-shadow: 0 0 6px 2px var(--select-color); }
  }
`

// Amber glow on the player icon card when the player fires
function PlayerCardFire({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'playerCardFire 400ms ease-out forwards',
        zIndex: 2,
      }}
    />
  )
}

// Amber glow on the mount card when it attacks
function MountGlow({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'mountFire 420ms ease-out forwards',
        zIndex: 2,
      }}
    />
  )
}

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
        <div className="pip-label">Field Medicine</div>
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

const PA_GUARD_ICON = (
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

  // Once this round's treatment budget is used up, an armed chem can't stay armed for a target we'll never reach.
  useEffect(() => {
    if (combat.chemUsesThisRound >= chemUseCap(player)) setArmedChem(null)
  }, [combat.chemUsesThisRound, player])

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

  return (
    <div className="flex flex-col gap-4">
      <style>{KEYFRAMES}</style>

      <div className="text-pip-red font-display text-3xl border-b border-pip-red pb-2">
        !! COMBAT !!
      </div>

      {/* Enemy unit row */}
      <div>
        <div className="pip-label mb-2">
          Enemies — {displayEnemies.filter(e => !e.dead).length} alive · {combat.capsPool} ¤ on them
        </div>
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
            className="pip-btn-danger flex-1"
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
            <button className="pip-btn-amber" onClick={openTamingMinigame} style={{ flexShrink: 0, fontSize: '0.9rem', padding: '2px 12px' }}>
              TAME
            </button>
          )}
          <button className="pip-btn-amber flex-1" disabled={isResolving} onClick={run}>
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

      {/* Protectors — grouped to reflect who actually draws enemy fire: PA guards up front,
          then regular guards + mount, then the player and brahmin held back */}
      {(player.guards.length > 0 || player.paGuards.length > 0 || player.brahmin > 0) && (
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">Protectors</div>
          <div className="flex flex-col gap-2">

            {player.paGuards.length > 0 && (
              <div className="flex gap-2 flex-wrap">
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
              </div>
            )}

            {(player.guards.length > 0 || player.mount) && (
              <div className="flex gap-2 flex-wrap">
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
                {/* Mount card */}
                {player.mount && (() => {
                  const mountHpPct  = Math.max(0, Math.round((displayMountHp / player.mount.maxHealth) * 100))
                  const mountHpColor = mountHpPct > 50 ? 'var(--pip-green)' : mountHpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
                  const mountIconFile = MOUNT_ICONS[player.mount.creatureTypeId]
                  const mountSvg = ENEMY_SVGS[player.mount.creatureTypeId] ?? ''
                  return (
                    <div
                      className="flex flex-col items-center gap-1"
                      style={{ width: '3rem', opacity: mountIsDead ? 0.35 : 1, filter: mountIsDead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
                    >
                      <div
                        key={anim.mountDodgeKey > 0 ? `dodge-${anim.mountDodgeKey}` : 'still'}
                        className="relative w-10 h-10 border rounded flex items-center justify-center"
                        style={{ borderColor: 'var(--pip-amber)', animation: anim.mountDodgeKey > 0 ? 'allyDodge 420ms ease-out' : 'none' }}
                      >
                        {!mountIsDead && <MountGlow flashKey={anim.mountFireKey} />}
                        <FlashOverlay flashKey={anim.mountDamageKey} variant="damage" />
                        {mountIconFile ? (
                          <img src={mountIconFile} alt="" className="w-7 h-7" style={{ opacity: 0.85 }} />
                        ) : (
                          <svg viewBox="0 0 48 48" className="w-7 h-7" style={{ color: 'var(--pip-amber)' }}
                            dangerouslySetInnerHTML={{ __html: mountSvg }}
                          />
                        )}
                      </div>
                      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                        <div className="h-full transition-all duration-500" style={{ width: `${mountHpPct}%`, backgroundColor: mountHpColor }} />
                      </div>
                      <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>MOUNT</div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Back row — the player themself, and brahmin (unarmed, never in the direct line of fire) */}
            <div className="flex gap-2 flex-wrap">
              {(() => {
                const hpPct = Math.max(0, Math.round((displayHealth / player.maxHealth) * 100))
                const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
                const apPct = player.armor ? Math.max(0, Math.round((displayAP / player.armor.maxArmorPoints) * 100)) : 0
                const selectable = isValidChemTarget('player', 'player')
                const selectColor = armedChem ? CHEM_COLOR[armedChem] : undefined
                const reloading = displayGunCooldown > 0
                return (
                  <div
                    className={`flex flex-col items-center gap-1 ${selectable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
                    style={{ width: '3rem', opacity: reloading ? 0.55 : 1, transition: 'opacity 400ms' }}
                    onClick={selectable ? () => applyArmedChemTo('player', 'player') : undefined}
                    title={selectable ? 'Apply here' : reloading ? `Reloading — ${displayGunCooldown} round${displayGunCooldown > 1 ? 's' : ''} left` : undefined}
                  >
                    <div
                      key={anim.playerDodgeKey > 0 ? `dodge-${anim.playerDodgeKey}` : 'still'}
                      className="relative w-10 h-10 border rounded flex items-center justify-center"
                      style={{
                        borderColor: selectable ? selectColor : 'var(--pip-amber)',
                        borderStyle: reloading ? 'dashed' : 'solid',
                        animation: anim.playerDodgeKey > 0 ? 'allyDodge 420ms ease-out' : selectable ? 'guardCardSelectablePulse 1.1s ease-in-out infinite' : 'none',
                        ...( selectable ? { '--select-color': selectColor } as React.CSSProperties : {} ),
                      }}
                    >
                      <PlayerCardFire flashKey={anim.playerFireKey} />
                      <FlashOverlay flashKey={anim.playerDamageKey} variant="damage" />
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
                        <path d="M6.02958 19.4012C5.97501 19.9508 6.3763 20.4405 6.92589 20.4951C7.47547 20.5497 7.96523 20.1484 8.01979 19.5988L6.02958 19.4012ZM15.9802 19.5988C16.0348 20.1484 16.5245 20.5497 17.0741 20.4951C17.6237 20.4405 18.025 19.9508 17.9704 19.4012L15.9802 19.5988ZM20 12C20 16.4183 16.4183 20 12 20V22C17.5228 22 22 17.5228 22 12H20ZM12 20C7.58172 20 4 16.4183 4 12H2C2 17.5228 6.47715 22 12 22V20ZM4 12C4 7.58172 7.58172 4 12 4V2C6.47715 2 2 6.47715 2 12H4ZM12 4C16.4183 4 20 7.58172 20 12H22C22 6.47715 17.5228 2 12 2V4ZM13 10C13 10.5523 12.5523 11 12 11V13C13.6569 13 15 11.6569 15 10H13ZM12 11C11.4477 11 11 10.5523 11 10H9C9 11.6569 10.3431 13 12 13V11ZM11 10C11 9.44772 11.4477 9 12 9V7C10.3431 7 9 8.34315 9 10H11ZM12 9C12.5523 9 13 9.44772 13 10H15C15 8.34315 13.6569 7 12 7V9ZM8.01979 19.5988C8.22038 17.5785 9.92646 16 12 16V14C8.88819 14 6.33072 16.3681 6.02958 19.4012L8.01979 19.5988ZM12 16C14.0735 16 15.7796 17.5785 15.9802 19.5988L17.9704 19.4012C17.6693 16.3681 15.1118 14 12 14V16Z" />
                      </svg>
                      {(() => {
                        const buff = findBuff(combat.activeBuffs, 'player', 'player')
                        return buff && <BuffBadge color={buff.color} roundsRemaining={buff.roundsRemaining} label={buff.label} />
                      })()}
                      {reloading && <BuffBadge kind="reload" color="var(--pip-amber)" roundsRemaining={displayGunCooldown} label="Reloading" />}
                    </div>
                    <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                      <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                    </div>
                    {player.armor && (
                      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                        <div className="h-full transition-all duration-500" style={{ width: `${apPct}%`, backgroundColor: 'var(--pip-blue)' }} />
                      </div>
                    )}
                    <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>
                      {reloading ? `RELOAD ${displayGunCooldown}t` : 'YOU'}
                    </div>
                  </div>
                )
              })()}

              {Array.from({ length: player.brahmin }).map((_, i) => (
                <div key={`b-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
                      {/* Body */}
                      <path d="M8 14C8 10.5 10.5 9 15 9C19.5 9 22 10.5 22 14C22 17.5 19.5 19 15 19C10.5 19 8 17.5 8 14Z" />
                      {/* Upper head — centered on upper half of body */}
                      <path d="M2 11C2 8 8 8 8 11C8 14 2 14 2 11Z" />
                      {/* Upper horns */}
                      <path d="M3.5 9C3 7.5 3.5 6 4.5 6C4.5 7 4 8 3.5 9ZM6.5 8.5C6.5 7 7.5 6 8 6C8 7 7.5 8 6.5 8.5Z" />
                      {/* Lower head — centered on lower half of body */}
                      <path d="M2 16C2 13.5 8 13.5 8 16C8 18.5 2 18.5 2 16Z" />
                      {/* Lower horns */}
                      <path d="M3.5 14C3 13 3.5 12 4.5 12C4.5 12.5 4 13.5 3.5 14ZM6.5 13.5C6.5 12.5 7.5 12 8 12C8 12.5 7.5 13 6.5 13.5Z" />
                      {/* Legs */}
                      <rect x="9.5" y="18" width="2" height="5.5" rx="1" />
                      <rect x="12.5" y="18" width="2" height="5.5" rx="1" />
                      <rect x="16" y="18.5" width="2" height="5" rx="1" />
                      <rect x="19" y="18.5" width="1.5" height="4.5" rx="0.75" />
                      {/* Tail */}
                      <path d="M22 13C23.5 11 23 9 21.5 8.5C22.5 10 22.5 12 22 13Z" />
                    </svg>
                  </div>
                  <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-amber)' }} />
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>BRAHMIN</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3" style={{ fontSize: '0.6rem', opacity: 0.6 }}>
            {player.guards.length > 0 && <span style={{ color: 'var(--pip-green)' }}>Guards: take partial damage, carry wounds into future rounds — heal free at a settlement doctor</span>}
            {player.paGuards.length > 0 && <span style={{ color: 'var(--pip-blue)' }}>PA guards: tougher, more likely to draw enemy fire</span>}
            {player.brahmin > 0 && <span style={{ color: 'var(--pip-amber)' }}>Each brahmin: −12% escape chance, 30% bolt risk on escape</span>}
          </div>
        </div>
      )}

      {!isResolved && <ChemTray player={player} combat={combat} armedChem={armedChem} setArmedChem={setArmedChem} />}

      {combat.playerVenomed && !isResolved && (
        <div className="border border-red-500 px-2 py-1 rounded text-xs flex items-center justify-between gap-2">
          <span className="text-red-400 font-bold">VENOMED — Accuracy -30%, -5 HP/round</span>
          {(player.inventory['antivenom']?.quantity ?? 0) > 0 && (
            <button className="pip-btn text-xs py-0.5 px-2 shrink-0" onClick={useAntivenom}>USE ANTIVENOM</button>
          )}
        </div>
      )}

      {/* Combat log — below buttons so it can't push them off screen */}
      <div className="border border-pip-border p-3 rounded bg-pip-border-dim text-xs font-mono space-y-1 overflow-y-auto max-h-48">
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
