import type { GuardClassId } from '../types/game'

export interface GuardClassDefinition {
  id: GuardClassId
  name: string
  description: string
  accuracy: number
  damage: [number, number]
  health: number
  hireCost: number
  salaryPerTurn: number
  splashRatios?: number[]   // shotgunner only — reuses the gun-splash mechanic
  grantsExtraChemUse?: boolean  // medic only — +1 to the per-round Field Medicine cap (see chemUseCap() in combat.ts) per living medic
  cooldownTurns?: number    // sniper only — rounds of reload after firing, reuses the gun-cooldown mechanic
}

export const GUARD_CLASSES: Record<GuardClassId, GuardClassDefinition> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'A reliable rifle hand. Balanced accuracy and damage.',
    accuracy: 0.55,
    damage: [20, 35],
    health: 50,
    hireCost: 150,
    salaryPerTurn: 35,
  },
  shotgunner: {
    id: 'shotgunner',
    name: 'Shotgunner',
    description: 'Sprays buckshot across the enemy line. Lower per-hit damage, hits multiple targets, rarely misses.',
    accuracy: 0.70,
    damage: [10, 18],
    health: 50,
    hireCost: 180,
    salaryPerTurn: 40,
    splashRatios: [0.60, 0.35],
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    description: 'Lines up devastating shots but needs a turn to reload after every shot.',
    accuracy: 0.75,
    damage: [50, 80],
    health: 40,
    hireCost: 200,
    salaryPerTurn: 45,
    cooldownTurns: 1,
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    description: 'Weak in a fight, but frees up your hands — each Medic in the squad grants one extra Field Medicine application per round.',
    accuracy: 0.40,
    damage: [10, 18],
    health: 30,
    hireCost: 175,
    salaryPerTurn: 40,
    grantsExtraChemUse: true,
  },
}

export const GUARD_CLASS_IDS = Object.keys(GUARD_CLASSES) as GuardClassId[]
