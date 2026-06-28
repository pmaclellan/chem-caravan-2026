import type { TransitQuote } from '../commonwealth/quotes'
export type { TransitQuote }

export const TRANSIT_QUOTES: TransitQuote[] = [
  // Merchants & trade
  { text: "The Strip takes a cut of everything. You accept it or you go home. Most people accept it.", speaker: "Veteran trader" },
  { text: "Turbo is rare out here. Find it — hold it. The price only goes up.", speaker: "Chem runner" },
  { text: "NCR runs the road but they don't run the prices. That's mine to run.", speaker: "Caravan boss" },
  { text: "Bought low in Goodsprings, sold high at Camp McCarran. It's not complicated. It's just dangerous.", speaker: "Lucky merchant" },
  { text: "The Mojave has better prices than the Commonwealth. The Mojave also has deathclaws at the quarry.", speaker: "Traveling merchant" },
  { text: "House's robots keep The Strip safe. Everything outside The Strip is educational.", speaker: "Strip vendor" },
  { text: "Legion doesn't buy. Legion takes. Bear that in mind near Nelson.", speaker: "Scarred trader" },

  // Road conditions & danger
  { text: "Quarry Junction. Don't. Just don't.", speaker: "Anyone who has been to Quarry Junction" },
  { text: "Fiends own the west side now. Great Khans own everything else. NCR disagrees.", speaker: "Caravan guard" },
  { text: "I've done the Goodsprings-Novac run forty times. I still pray each time.", speaker: "Veteran courier" },
  { text: "Legion patrols are increasing east of the dam. Whatever they're planning, it's soon.", speaker: "NCR scout" },
  { text: "Highway 95 is fine in daylight. At night it belongs to something else.", speaker: "Night traveler (surviving)" },
  { text: "The Khans are predictable. That's both good and bad.", speaker: "Experienced caravan driver" },

  // Settlement gossip
  { text: "Freeside's rough but honest. That's more than I can say for The Strip.", speaker: "Freeside regular" },
  { text: "Camp McCarran has a bar. A military base with a bar. The NCR understands morale.", speaker: "Soldier on leave" },
  { text: "Jacobstown super mutants won't attack unprovoked. Emphasis on unprovoked.", speaker: "Cautious traveler" },
  { text: "Goodsprings has the best water in the Mojave. Nobody talks about it because then everyone would go there.", speaker: "Local resident" },
  { text: "Novac is a handful of people watching each other's back. It works. Barely.", speaker: "Novac resident" },

  // Chems & addiction
  { text: "Turbo slows time. Costs a fortune. Worth every cap when the deathclaw is already running.", speaker: "Combat veteran" },
  { text: "Rocket is what happens when someone asks 'what if Psycho was faster.' The answer is terrible.", speaker: "Medical courier" },
  { text: "The Mojave runs on jet, mentats, and paranoia. Mostly paranoia.", speaker: "Weary trader" },

  // Wasteland philosophy
  { text: "War never changes. I've been saying that for thirty years. Still waiting to be wrong.", speaker: "Old NCR veteran" },
  { text: "The house always wins. The question is which house you're betting on.", speaker: "Strip gambler" },
  { text: "Out here, the line between smart and lucky is mostly luck.", speaker: "Goodsprings drifter" },
  { text: "The Mojave will teach you respect or it will kill you. Either way, lesson learned.", speaker: "Desert hermit" },

  // Gameplay tips
  { text: "The Great Khans operate a drug lab out of Red Rock Canyon. It's the place to go for reliably cheap chems — if you can make it past the Cazadors and Deathclaws on the approach.", speaker: "Omniscient Guide" },
  { text: "Cazador venom doesn't stop when the fight does. It drains HP every turn until you use antivenom or see a doctor. Don't skip the antivenom before heading northwest.", speaker: "Omniscient Guide" },
  { text: "The Strip, Freeside, and NCR Sharecropper Farms are relatively safe roads — you'll run into Thugs and Fiends, not apex predators. Good early-run trade routes.", speaker: "Omniscient Guide" },
  { text: "Novac is isolated but well-supplied. The run from Goodsprings is long and dangerous. Make it count — go with a full pack.", speaker: "Omniscient Guide" },
  { text: "Guards improve your odds of escaping an ambush and fight alongside you. Brahmin carry more chems but slow you down when things go wrong. Pack accordingly.", speaker: "Omniscient Guide" },
  { text: "Sloan is a dead end — the Quarry is overrun with Deathclaws. The value is in what Camp McCarran will pay for a full pack of chems, not in the road itself.", speaker: "Omniscient Guide" },
  { text: "Legion Assassins operate on an escalating contract. Miss a payment window and they find you. Miss two and they don't leave you walking.", speaker: "Omniscient Guide" },
  { text: "Turbo and Rocket are Mojave-exclusive. The demand is local, but the margins on both are exceptional if you can find them cheap and sell at Camp McCarran or Novac.", speaker: "Omniscient Guide" },
  { text: "Interest compounds every turn you carry debt. Paying it off faster isn't just safer — it's cheaper.", speaker: "Omniscient Guide" },
  { text: "You can own multiple guns and switch between them at any settlement. If you run dry on ammo mid-run, a backup weapon with rounds left can save the caravan.", speaker: "Omniscient Guide" },
]

export function pickQuote(): TransitQuote {
  return TRANSIT_QUOTES[Math.floor(Math.random() * TRANSIT_QUOTES.length)]
}
