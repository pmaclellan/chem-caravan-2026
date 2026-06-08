import type { TravelEventType } from '../../../types/game'

export interface TravelEventDefinition {
  type: TravelEventType
  weight: number             // relative probability weight (higher = more likely)
  minDangerToTrigger: number // only eligible on roads with dangerLevel >= this
  title: string
  description: string
}

export const TRAVEL_EVENT_DEFS: TravelEventDefinition[] = [
  {
    type: 'raider_ambush',
    weight: 30,
    minDangerToTrigger: 0.30,
    title: "RAIDER AMBUSH",
    description: "A gang of Raiders steps out from the ruins, weapons raised. Your caravan comes to a halt.",
  },
  {
    type: 'chem_stash',
    weight: 20,
    minDangerToTrigger: 0,
    title: "CHEM STASH FOUND",
    description: "You spot a dead courier slumped against a rusted car. Their pack is full of chems.",
  },
  {
    type: 'wandering_merchant',
    weight: 15,
    minDangerToTrigger: 0,
    title: "WANDERING MERCHANT",
    description: "A lone merchant flags you down from the roadside. Looks like they're willing to deal.",
  },
  {
    type: 'brahmin_lost',
    weight: 15,
    minDangerToTrigger: 0.20,
    title: "BRAHMIN LOST",
    description: "Distant gunfire spooked your brahmin. One bolted into the wastes before you could stop it.",
  },
  {
    type: 'debt_collector',
    weight: 0,   // weight 0 = only triggered explicitly by engine, never randomly
    minDangerToTrigger: 0,
    title: "DEBT COLLECTOR",
    description: "A pair of Triggermen step out of an alley. They're wearing expensive suits and unhappy expressions.",
  },
  {
    type: 'brotherhood_checkpoint',
    weight: 10,
    minDangerToTrigger: 0,
    title: "BROTHERHOOD CHECKPOINT",
    description: "A Paladin and two knights have set up a checkpoint across the road ahead.",
  },
]

// Chem stash: which chems can be found and in what quantities
export const STASH_CHEMS = ['jet', 'psycho', 'buffout', 'radx', 'radaway', 'mentats']
export const STASH_QUANTITY_MIN = 1
export const STASH_QUANTITY_MAX = 4

// Brotherhood toll
export const BROTHERHOOD_TOLL = 100   // caps

// Wandering merchant: a small random selection of chems at slightly above market
export const MERCHANT_PRICE_MARKUP = 1.25
export const MERCHANT_CHEM_COUNT = 3
