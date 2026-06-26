import type { TravelEventDefinition } from '../commonwealth/events'
export type { TravelEventDefinition }

export const TRAVEL_EVENT_DEFS: TravelEventDefinition[] = [
  {
    type: 'chem_stash',
    weight: 20,
    minDangerToTrigger: 0,
    title: "CHEM STASH FOUND",
    description: "A dead courier off the highway. Their pack has chems — you're lighter than they were.",
  },
  {
    type: 'wandering_merchant',
    weight: 15,
    minDangerToTrigger: 0,
    title: "WANDERING MERCHANT",
    description: "A wasteland merchant waves from the roadside. They've got goods and they're moving fast.",
  },
  {
    type: 'brahmin_lost',
    weight: 15,
    minDangerToTrigger: 0.20,
    title: "BRAHMIN LOST",
    description: "A deathclaw roar sent your brahmin into a panic. One bolted and won't be coming back.",
  },
  {
    type: 'debt_collector',
    weight: 0,
    minDangerToTrigger: 0,
    title: "DEBT COLLECTOR",
    description: "Legion Assassins block the road. They have a message from your lender. It's not a letter.",
  },
  {
    type: 'brotherhood_checkpoint',
    weight: 10,
    minDangerToTrigger: 0,
    title: "NCR CHECKPOINT",
    description: "NCR rangers have set up a roadblock. They're 'inspecting' for contraband.",
  },
]

export const STASH_CHEMS = ['jet', 'psycho', 'buffout', 'radx', 'radaway', 'mentats', 'stimpak', 'turbo']
export const STASH_QUANTITY_MIN = 1
export const STASH_QUANTITY_MAX = 4
export const BROTHERHOOD_TOLL = 120
