import { useState } from 'react'
import type { CombatReplay } from '@main/types/game'
import { useCombatReplayFrame } from '@main/hooks/useCombatReplay'
import EnemyUnitCard from '@main/components/game/EnemyUnitCard'
import GuardUnitCard from '@main/components/game/GuardUnitCard'
import GuardClassIcon from '@main/components/game/guardClassIcons'
import { GUARD_CLASSES } from '@main/data/guardClasses'
import { useArrowKeyStep } from '../hooks/useArrowKeyStep'

// Small local copy of CombatPanel's PA_GUARD_ICON path data — deliberately not imported from
// CombatPanel.tsx, which pulls in useGameStore (and transitively the public app's Supabase
// client/env vars) at module scope. This admin app must never import that module graph.
function PaGuardIcon() {
  return (
    <svg viewBox="0 0 100 100" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
      <g transform="translate(0,100) scale(0.1,-0.1)">
        <path d="M781 976 c-20 -21 -26 -23 -42 -13 -16 10 -24 7 -51 -20 -26 -27 -29 -34 -19 -47 18 -22 4 -38 -28 -31 -21 4 -33 -1 -55 -24 -25 -26 -27 -33 -16 -46 12 -14 2 -27 -70 -100 -83 -84 -85 -85 -125 -78 -32 4 -54 19 -111 74 -40 38 -77 69 -84 69 -19 0 -54 -21 -72 -44 -32 -38 -22 -64 52 -140 38 -40 70 -80 70 -89 0 -15 -44 -57 -60 -57 -4 0 -16 17 -25 37 -23 50 -44 73 -66 73 -29 0 -79 -49 -79 -77 0 -27 36 -93 50 -93 5 0 14 -9 20 -20 9 -16 7 -26 -9 -47 -39 -48 -30 -68 82 -180 133 -133 129 -133 256 -8 63 61 105 95 119 95 28 0 108 77 117 112 4 17 1 39 -9 60 l-17 32 82 82 c70 70 86 82 108 78 37 -8 81 38 64 66 -17 26 9 49 33 30 13 -11 20 -9 47 18 26 27 30 35 20 50 -9 14 -6 22 15 45 l26 27 -94 95 c-52 52 -97 95 -101 95 -3 0 -16 -11 -28 -24z" />
      </g>
    </svg>
  )
}

interface Props {
  replay: CombatReplay
  onBack: () => void
}

export default function CombatReplayViewer({ replay, onBack }: Props) {
  const [stepIndex, setStepIndex] = useState(-1)
  const lastIndex = replay.steps.length - 1

  useArrowKeyStep(
    () => setStepIndex(i => Math.max(-1, i - 1)),
    () => setStepIndex(i => Math.min(lastIndex, i + 1)),
    replay.steps.length > 0,
  )

  const frame = useCombatReplayFrame(replay.steps, replay.initialRoster, stepIndex)
  const { enemies, guards, paGuards, mount } = replay.initialRoster

  if (replay.steps.length === 0) {
    return (
      <div className="pip-panel flex flex-col h-full min-h-0">
        <button className="pip-btn text-xs py-1 px-3 self-start mb-2" onClick={onBack}>← BACK TO TURNS</button>
        <div className="text-sm text-pip-green-dim">No animated steps recorded for this encounter (outcome: {replay.outcome}) — likely a taming or an instant resolution.</div>
      </div>
    )
  }

  return (
    <div className="pip-panel flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2">
        <button className="pip-btn text-xs py-1 px-3" onClick={onBack}>← BACK TO TURNS</button>
        <div className="font-display text-lg text-pip-amber">
          COMBAT REPLAY — WAVE {replay.waveNumber} ({replay.outcome.toUpperCase()})
        </div>
        <div className="text-xs font-mono text-pip-green-dim">STEP {stepIndex + 1} / {replay.steps.length}</div>
      </div>
      <div className="text-[10px] font-mono text-pip-green-dim text-center mb-3">Use ← / → arrow keys to step through the encounter</div>

      <div className="flex gap-2 mb-3 justify-center">
        <button className="pip-btn text-xs py-1 px-3" disabled={stepIndex <= -1} onClick={() => setStepIndex(i => Math.max(-1, i - 1))}>← PREV STEP</button>
        <button className="pip-btn text-xs py-1 px-3" disabled={stepIndex >= lastIndex} onClick={() => setStepIndex(i => Math.min(lastIndex, i + 1))}>NEXT STEP →</button>
      </div>

      {/* Enemies */}
      <div className="border border-pip-border rounded p-3 mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-red) 5%, transparent)' }}>
        <div className="pip-label mb-2">Enemies</div>
        <div className="flex gap-3 flex-wrap">
          {enemies.map(unit => {
            const displayHealth = frame.displayEnemyHealth[unit.id] ?? unit.health
            const animEntry = frame.enemyAnimInfo[unit.id]
            return (
              <EnemyUnitCard
                key={`${unit.id}-${stepIndex}`}
                unit={{ ...unit, health: displayHealth, dead: displayHealth <= 0 }}
                flashKey={frame.enemyHitKeys[unit.id] ?? 0}
                isHit={animEntry?.type === 'hit'}
                isDodge={animEntry?.type === 'miss'}
                isAttacking={animEntry?.type === 'attack'}
              />
            )
          })}
        </div>
      </div>

      {/* Player + caravan */}
      <div className="border border-pip-border rounded p-3 mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-green) 5%, transparent)' }}>
        <div className="pip-label mb-2">Caravan</div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
            <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-green)' }}>
              <span className="text-[10px] text-pip-green-dim">YOU</span>
            </div>
            <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
              <div className="h-full transition-all duration-300" style={{ width: `${replay.initialRoster.playerHealth > 0 ? Math.max(0, Math.round((frame.displayPlayerHealth / replay.initialRoster.playerHealth) * 100)) : 0}%`, backgroundColor: 'var(--pip-red)' }} />
            </div>
            <div className="text-[9px] text-pip-green-dim">{frame.displayPlayerHealth} HP{frame.displayPlayerAP > 0 ? ` · ${frame.displayPlayerAP} AP` : ''}</div>
          </div>

          {guards.map(g => (
            <GuardUnitCard
              key={g.id}
              unit={{ ...g, health: frame.displayGuardHealth[g.id] ?? g.health, dead: g.dead || (frame.displayGuardHealth[g.id] ?? g.health) <= 0 }}
              label={GUARD_CLASSES[g.classId].name.toUpperCase()}
              color="var(--pip-green)"
              icon={<GuardClassIcon classId={g.classId} color="var(--pip-green)" />}
              fireFlashKey={frame.guardFireKeys[g.id] ?? 0}
              damageFlashKey={frame.guardDamageKeys[g.id] ?? 0}
              dodgeFlashKey={frame.guardDodgeKeys[g.id] ?? 0}
              reloadRoundsRemaining={frame.displayGuardCooldown[g.id] ?? g.cooldownRemaining ?? 0}
            />
          ))}

          {paGuards.map(g => (
            <GuardUnitCard
              key={g.id}
              unit={{ ...g, health: frame.displayPAGuardHealth[g.id] ?? g.health, dead: g.dead || (frame.displayPAGuardHealth[g.id] ?? g.health) <= 0 }}
              label="PA"
              color="var(--pip-blue)"
              icon={<PaGuardIcon />}
              fireFlashKey={frame.guardFireKeys[g.id] ?? 0}
              damageFlashKey={frame.guardDamageKeys[g.id] ?? 0}
              dodgeFlashKey={frame.guardDodgeKeys[g.id] ?? 0}
              armorPoints={frame.displayPAGuardArmor[g.id] ?? g.armorPoints}
              maxArmorPoints={g.maxArmorPoints}
            />
          ))}

          {mount && (
            <div className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
              <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                <span className="text-[9px] text-pip-amber">MNT</span>
              </div>
              <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                <div className="h-full transition-all duration-300" style={{ width: `${mount.maxHealth > 0 ? Math.max(0, Math.round((frame.displayMountHealth / mount.maxHealth) * 100)) : 0}%`, backgroundColor: frame.mountDied ? 'var(--pip-border-dim)' : 'var(--pip-amber)' }} />
              </div>
              <div className="text-[9px] text-pip-green-dim">{frame.mountDied ? 'DEAD' : `${frame.displayMountHealth} HP`}</div>
            </div>
          )}
        </div>
      </div>

      {/* Current step log lines */}
      <div className="border border-pip-border p-3 rounded bg-pip-border-dim text-xs font-mono space-y-1 flex-1 overflow-y-auto min-h-0">
        {stepIndex === -1 && <div className="text-pip-green-dim">&gt; Encounter begins.</div>}
        {frame.currentLogLines.map((line, i) => (
          <div key={i} className="text-pip-green">&gt; {line}</div>
        ))}
      </div>
    </div>
  )
}
