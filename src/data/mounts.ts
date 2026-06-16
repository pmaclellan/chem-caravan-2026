import type { MountState, TamingToolId, TamingToolState } from '../types/game'

// Single source of truth for which enemy type IDs can be tamed.
// TAMED_MOUNT_STATS is keyed by this union, so TypeScript enforces all three entries exist.
export const TAMEABLE_ENEMY_TYPE_IDS = ['yao_guai', 'radscorpion', 'deathclaw'] as const
export type TameableEnemyId = typeof TAMEABLE_ENEMY_TYPE_IDS[number]
export const TAMEABLE_ENEMY_IDS = new Set<string>(TAMEABLE_ENEMY_TYPE_IDS)

export function isTameable(typeId: string): typeId is TameableEnemyId {
  return TAMEABLE_ENEMY_IDS.has(typeId)
}

// HP fraction at which the TAME button appears
export const TAME_HP_THRESHOLD = 0.30

// Taming tool definitions — each entry has both purchase info and mini-game params.
// TamingToolState embeds greenWindowFraction/cursorSpeedMultiplier so the mini-game
// component receives everything it needs without reaching back into this module.
export interface TamingToolDefinition {
  id: TamingToolId
  name: string
  price: number
  description: string
  greenWindowFraction: number
  cursorSpeedMultiplier: number
}

export const TAMING_TOOLS: Record<TamingToolId, TamingToolDefinition> = {
  lasso: {
    id: 'lasso',
    name: 'Lasso',
    price: 150,
    description: 'For the reckless.',
    greenWindowFraction: 0.12,
    cursorSpeedMultiplier: 1.5,
  },
  tranq_gun: {
    id: 'tranq_gun',
    name: 'Tranquilizer Gun',
    price: 1500,
    description: 'For those with patience.',
    greenWindowFraction: 0.22,
    cursorSpeedMultiplier: 1.0,
  },
  mesmetron: {
    id: 'mesmetron',
    name: 'Mesmetron',
    price: 8000,
    description: 'For those who want control.',
    greenWindowFraction: 0.38,
    cursorSpeedMultiplier: 0.6,
  },
}

export const TAMING_TOOL_IDS: TamingToolId[] = ['lasso', 'tranq_gun', 'mesmetron']

export const SADDLE_PRICE = 400

export function makeTamingToolState(def: TamingToolDefinition): TamingToolState {
  return {
    id: def.id,
    name: def.name,
    greenWindowFraction: def.greenWindowFraction,
    cursorSpeedMultiplier: def.cursorSpeedMultiplier,
  }
}

// Tamed creature stats — intentionally softer than wild (enemy stats in modeConfig.enemyStats).
// Record<TameableEnemyId, ...> forces TypeScript to verify all three keys are present.
export const TAMED_MOUNT_STATS: Record<TameableEnemyId, MountState> = {
  yao_guai: {
    creatureTypeId: 'yao_guai',
    name: 'Tamed Yao Guai',
    health: 60,
    maxHealth: 60,
    damage: [15, 30],
    accuracy: 0.70,
  },
  radscorpion: {
    creatureTypeId: 'radscorpion',
    name: 'Tamed Radscorpion',
    health: 50,
    maxHealth: 50,
    damage: [12, 25],
    accuracy: 0.65,
  },
  deathclaw: {
    creatureTypeId: 'deathclaw',
    name: 'Tamed Deathclaw',
    health: 100,
    maxHealth: 100,
    damage: [25, 50],
    accuracy: 0.75,
  },
}
