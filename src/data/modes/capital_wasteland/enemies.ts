import type { EnemyType } from '../../../types/game'

export const CAPITAL_WASTELAND_ENEMIES: EnemyType[] = [
  {
    id: 'raider',
    name: 'Raider',
    caps: [20, 150],
    lootChems: ['jet', 'psycho', 'buffout', 'radx', 'radaway'],
  },
  {
    id: 'super_mutant',
    name: 'Super Mutant',
    caps: [10, 80],
    lootChems: ['psycho', 'buffout', 'stimpak'],
  },
]
