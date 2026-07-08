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
  isMedic?: boolean
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
    description: 'Lines up devastating shots but doesn\'t land many. Glass cannon — low HP, high burst.',
    accuracy: 0.35,
    damage: [45, 70],
    health: 40,
    hireCost: 200,
    salaryPerTurn: 45,
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    description: 'Weak in a fight, but keeps the caravan patched up — auto-uses a Stimpak on the most wounded ally each round, if one is available.',
    accuracy: 0.40,
    damage: [10, 18],
    health: 55,
    hireCost: 175,
    salaryPerTurn: 40,
    isMedic: true,
  },
}

export const GUARD_CLASS_IDS = Object.keys(GUARD_CLASSES) as GuardClassId[]
