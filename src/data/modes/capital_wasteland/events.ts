import type { TravelEventDefinition } from '../commonwealth/events'
export type { TravelEventDefinition }

export const TRAVEL_EVENT_DEFS: TravelEventDefinition[] = [
  {
    type: 'raider_ambush',
    weight: 30,
    minDangerToTrigger: 0.30,
    title: "AMBUSH",
    description: "Armed hostiles step out from the ruins ahead. Your caravan is blocked.",
  },
  {
    type: 'chem_stash',
    weight: 20,
    minDangerToTrigger: 0,
    title: "CHEM STASH FOUND",
    description: "A dead Vault-Tec courier slumped by the roadside. Their pack has chems.",
  },
  {
    type: 'wandering_merchant',
    weight: 15,
    minDangerToTrigger: 0,
    title: "WANDERING MERCHANT",
    description: "A merchant flags you down from a rusted overpass railing.",
  },
  {
    type: 'brahmin_lost',
    weight: 15,
    minDangerToTrigger: 0.20,
    title: "BRAHMIN LOST",
    description: "Super Mutant howls sent your brahmin bolting. One won't be coming back.",
  },
  {
    type: 'debt_collector',
    weight: 0,
    minDangerToTrigger: 0,
    title: "DEBT COLLECTOR",
    description: "A pair of Talon Company mercs are waiting on the road. They look expensive and very unhappy.",
  },
  {
    type: 'brotherhood_checkpoint',
    weight: 10,
    minDangerToTrigger: 0,
    title: "BROTHERHOOD CHECKPOINT",
    description: "Brotherhood of Steel Paladins have blocked the road with a Vertibird.",
  },
]

export const STASH_CHEMS = ['jet', 'psycho', 'buffout', 'radx', 'radaway', 'mentats', 'stimpak']
export const STASH_QUANTITY_MIN = 1
export const STASH_QUANTITY_MAX = 4
export const BROTHERHOOD_TOLL = 150
export const MERCHANT_PRICE_MARKUP = 1.25
export const MERCHANT_CHEM_COUNT = 3
