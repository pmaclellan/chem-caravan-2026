import type { EnemyType } from '../../../types/game'

export const MOJAVE_WASTELAND_ENEMIES: EnemyType[] = [
  {
    id: 'fiend',
    name: 'Fiend',
    caps: [15, 100],
    lootChems: ['jet', 'psycho', 'buffout', 'radx', 'radaway'],
  },
  {
    id: 'great_khan',
    name: 'Great Khan',
    caps: [20, 120],
    lootChems: ['psycho', 'buffout', 'mentats'],
  },
  {
    id: 'legionnaire',
    name: 'Legionnaire',
    caps: [5, 50],
    lootChems: ['stimpak', 'medx'],
  },
  {
    id: 'deathclaw',
    name: 'Deathclaw',
    caps: [0, 0],
    lootChems: [],
  },
]
