import type { TransitQuote } from '../commonwealth/quotes'
export type { TransitQuote }

export const TRANSIT_QUOTES: TransitQuote[] = [
  // Merchants & trade
  { text: "Rivet City prices are highway robbery. And I mean that literally — Rivet City is only accessible by boat.", speaker: "Canterbury caravan driver" },
  { text: "Nuka-Cola Quantum. You see one — you buy it. You don't ask questions.", speaker: "Veteran trader" },
  { text: "Three caravans got hit between Megaton and Canterbury this week. Three.", speaker: "Shaken merchant" },
  { text: "The Brotherhood taxes every chem shipment coming through. They call it 'confiscation.' I call it theft.", speaker: "Underground trader" },
  { text: "A wise man once said: never take the Mall shortcut. That man is still alive.", speaker: "Experienced courier" },
  { text: "Stimpaks are worth twice what they cost in Rivet City out here in the open wastes.", speaker: "Wandering medic" },
  { text: "I've been running chems in the Capital Wasteland for twenty years. My retirement plan is not getting shot.", speaker: "Grizzled merchant" },

  // Road conditions & danger
  { text: "Super Mutants have the Mall now. Have had it for years. Nobody's taking it back.", speaker: "Former soldier" },
  { text: "The D.C. ruins are a death trap. Beautiful in a horrible way, but a death trap.", speaker: "Caravan guard" },
  { text: "Talon Company has a contract on half the people I know. Including me.", speaker: "Nervous trader" },
  { text: "Mirelurks in the Potomac won't bother you unless you go near the water. Don't go near the water.", speaker: "River ferry operator" },
  { text: "Pentagon Road used to be clear. Used to be.", speaker: "Brotherhood scout" },
  { text: "I took the Route 1 run six days in a row. On day seven I took a different road. Still here.", speaker: "Superstitious merchant" },

  // Settlement gossip
  { text: "Rivet City's bridge guard is a bully. The tolls aren't even official.", speaker: "Frustrated trader" },
  { text: "Tenpenny Tower let me in once. I had the caps. I didn't like the company.", speaker: "Wandering merchant" },
  { text: "Megaton should have been a crater. I say that with love — it's somehow still standing.", speaker: "Longtime Megaton resident" },
  { text: "Underworld's full of ghouls. Best med supplies in the Wasteland, though. Go figure.", speaker: "Cautious traveler" },
  { text: "Canterbury Commons gets hit by raiders, slavers, and the occasional mutant army. Still open for business.", speaker: "Canterbury shop owner" },
  { text: "Little Lamplight won't trade with adults. I respect that policy even as it infuriates me.", speaker: "Frustrated caravan leader" },

  // Chems & addiction
  { text: "Nuka-Cola Quantum glows in the dark. That should concern you. It only makes it more valuable.", speaker: "Chem merchant" },
  { text: "Rad-X is the difference between a day trip to the river and a very short life.", speaker: "Wastelander" },
  { text: "I quit Psycho three times. The third time it stuck. Mostly.", speaker: "Reformed raider" },

  // Wasteland philosophy
  { text: "Before the war, this was the capital of the free world. Now look at it.", speaker: "Pre-war history buff" },
  { text: "The wasteland doesn't care about your caps or your plans. Make plans anyway.", speaker: "Old Megaton settler" },
  { text: "Everyone's got a story about the day the bombs fell. Nobody's story ends well.", speaker: "Ancient survivor" },
  { text: "Keep moving. The Wasteland rewards movement and punishes stillness.", speaker: "Veteran caravan hand" },
]

export function pickQuote(): TransitQuote {
  return TRANSIT_QUOTES[Math.floor(Math.random() * TRANSIT_QUOTES.length)]
}
