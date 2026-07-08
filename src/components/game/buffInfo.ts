import type { ActiveBuff } from '../../types/game'

export interface BuffInfo {
  color: string           // 'var(--pip-amber)' for Jet, 'var(--pip-blue)' for Ultrajet
  roundsRemaining: number
  label: string            // 'Jet' | 'Ultrajet' — used in the badge tooltip
}

export function findBuff(
  activeBuffs: ActiveBuff[],
  targetKind: 'player' | 'guard' | 'pa_guard',
  targetId: string,
): BuffInfo | null {
  const buff = activeBuffs.find(b => b.targetKind === targetKind && b.targetId === targetId)
  if (!buff) return null
  const isUltra = buff.chemId === 'ultrajet'
  return {
    color: isUltra ? 'var(--pip-blue)' : 'var(--pip-amber)',
    roundsRemaining: buff.roundsRemaining,
    label: isUltra ? 'Ultrajet' : 'Jet',
  }
}
