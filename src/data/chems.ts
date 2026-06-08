export interface ChemDefinition {
  id: string
  name: string
  basePrice: number
  priceVariance: number    // fraction ±, e.g. 0.35 = ±35%
  availability: number     // 0-1 probability of being stocked per settlement per turn
  maxStock: number         // max units available when stocked
  highPriceMsg: string     // shown in log when price is above average
  lowPriceMsg: string      // shown in log when price is below average
  description: string
  imageUrl: string | null  // Fallout wiki item icon (null = no image available)
}

// Images sourced from the Fallout wiki (fallout.fandom.com) — Bethesda copyright, fan use only
const W = 'https://static.wikia.nocookie.net/fallout/images'

export const CHEMS: Record<string, ChemDefinition> = {
  jet: {
    id: 'jet',
    name: 'Jet',
    basePrice: 80,
    priceVariance: 0.55,
    availability: 0.85,
    maxStock: 15,
    highPriceMsg: "Brahmin ranchers been buying up all the Jet.",
    lowPriceMsg: "Chem cookers must be working overtime — Jet is dirt cheap.",
    description: "The Commonwealth's most popular chem. Slows time to a crawl.",
    imageUrl: `${W}/4/4d/Fallout4_Jet.png`,
  },
  psycho: {
    id: 'psycho',
    name: 'Psycho',
    basePrice: 120,
    priceVariance: 0.60,
    availability: 0.70,
    maxStock: 10,
    highPriceMsg: "Raiders cleared out the local Psycho supply.",
    lowPriceMsg: "Surplus Psycho hit the market from a Super Mutant camp.",
    description: "Military-grade combat drug. Rage in a syringe.",
    imageUrl: `${W}/7/73/Fallout4_Psycho.png`,
  },
  medx: {
    id: 'medx',
    name: 'Med-X',
    basePrice: 150,
    priceVariance: 0.50,
    availability: 0.65,
    maxStock: 8,
    highPriceMsg: "The Institute's been buying Med-X in bulk.",
    lowPriceMsg: "Caravan brought in a shipment — Med-X is on sale.",
    description: "Morphine derivative. Treats pain, creates dependency.",
    imageUrl: `${W}/c/cb/Fo4_Med-X.png`,
  },
  buffout: {
    id: 'buffout',
    name: 'Buffout',
    basePrice: 100,
    priceVariance: 0.50,
    availability: 0.75,
    maxStock: 12,
    highPriceMsg: "Super Mutants cornered the Buffout market again.",
    lowPriceMsg: "Pre-war stockpile found — Buffout prices tanked.",
    description: "Anabolic steroid cocktail. Strength and endurance boost.",
    imageUrl: `${W}/b/b8/Fallout4_Buffout.png`,
  },
  mentats: {
    id: 'mentats',
    name: 'Mentats',
    basePrice: 90,
    priceVariance: 0.50,
    availability: 0.70,
    maxStock: 10,
    highPriceMsg: "Diamond City traders buying Mentats hand over fist.",
    lowPriceMsg: "Mentats recipe leaked — prices dropped hard.",
    description: "Cognitive enhancers. Beloved by merchants and hackers.",
    imageUrl: `${W}/3/37/Fallout4_Mentats.png`,
  },
  radx: {
    id: 'radx',
    name: 'Rad-X',
    basePrice: 60,
    priceVariance: 0.45,
    availability: 0.80,
    maxStock: 20,
    highPriceMsg: "Glowing Sea explorers cleaned out all the Rad-X.",
    lowPriceMsg: "Rad-X flowing cheap after a Vault-Tec cache was cracked open.",
    description: "Radiation resistance pill. Ubiquitous in the wasteland.",
    imageUrl: `${W}/1/19/Fallout4_Rad-X.png`,
  },
  radaway: {
    id: 'radaway',
    name: 'RadAway',
    basePrice: 75,
    priceVariance: 0.45,
    availability: 0.75,
    maxStock: 15,
    highPriceMsg: "Radiation spike sent RadAway prices sky-high.",
    lowPriceMsg: "Synth scavengers flooded the market with RadAway.",
    description: "Radiation flush solution. Essential for survivors.",
    imageUrl: `${W}/2/2b/Fallout4_RadAway.png`,
  },
  stimpak: {
    id: 'stimpak',
    name: 'Stimpak',
    basePrice: 200,
    priceVariance: 0.45,
    availability: 0.60,
    maxStock: 6,
    highPriceMsg: "Railroad and BoS are buying every Stimpak in sight.",
    lowPriceMsg: "A factory found intact — Stimpaks are rock bottom.",
    description: "Healing nanomachine injection. The most valuable chem.",
    imageUrl: `${W}/e/e7/Fallout4_Stimpak.png`,
  },
  ultrajet: {
    id: 'ultrajet',
    name: 'Ultrajet',
    basePrice: 350,
    priceVariance: 0.65,
    availability: 0.25,
    maxStock: 4,
    highPriceMsg: "Word is the Ultrajet recipe is a state secret — prices soaring.",
    lowPriceMsg: "A wandering chemist undercut everyone — Ultrajet cheap today.",
    description: "Refined Jet. Rarer and far more potent.",
    imageUrl: `${W}/4/4d/Fallout4_Jet.png`, // no dedicated icon; Ultrajet is refined Jet
  },
  daytripper: {
    id: 'daytripper',
    name: 'Daytripper',
    basePrice: 110,
    priceVariance: 0.40,
    availability: 0.45,
    maxStock: 8,
    highPriceMsg: "Goodneighbor pleasure-seekers drove up Daytripper prices.",
    lowPriceMsg: "Bad batch went around — sellers are dumping inventory.",
    description: "Euphoria chem. Popular in settlements with a nightlife.",
    imageUrl: null,
  },
  // Capital Wasteland exclusive
  nuka_cola_quantum: {
    id: 'nuka_cola_quantum',
    name: 'Nuka-Cola Quantum',
    basePrice: 250,
    priceVariance: 0.45,
    availability: 0.20,
    maxStock: 3,
    highPriceMsg: "Pre-war Quantum is drying up — prices shot through the roof.",
    lowPriceMsg: "A Nuka-Cola warehouse cache just hit the market. Grab it while it lasts.",
    description: "Radioactive soft drink. Rare, potent, and blue.",
    imageUrl: null,
  },
  // Mojave Wasteland exclusives
  turbo: {
    id: 'turbo',
    name: 'Turbo',
    basePrice: 180,
    priceVariance: 0.60,
    availability: 0.30,
    maxStock: 6,
    highPriceMsg: "Turbo cooks can't keep up with demand — prices are spiking.",
    lowPriceMsg: "Great Khans flooded the market with cut-rate Turbo.",
    description: "Slows time. Fiend-made. The Mojave's specialty chem.",
    imageUrl: null,
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    basePrice: 220,
    priceVariance: 0.55,
    availability: 0.25,
    maxStock: 5,
    highPriceMsg: "Rocket supply dried up — someone torched the lab.",
    lowPriceMsg: "Oversupply hit the Mojave. Rocket is moving cheap.",
    description: "Combat stimulant. Extreme aggression boost. Do not take recreationally.",
    imageUrl: null,
  },
}

export const CHEM_IDS = Object.keys(CHEMS)
