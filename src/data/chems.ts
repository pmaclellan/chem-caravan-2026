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
}

export const CHEMS: Record<string, ChemDefinition> = {
  jet: {
    id: 'jet',
    name: 'Jet',
    basePrice: 80,
    priceVariance: 0.35,
    availability: 0.85,
    maxStock: 15,
    highPriceMsg: "Brahmin ranchers been buying up all the Jet.",
    lowPriceMsg: "Chem cookers must be working overtime — Jet is dirt cheap.",
    description: "The Commonwealth's most popular chem. Slows time to a crawl.",
  },
  psycho: {
    id: 'psycho',
    name: 'Psycho',
    basePrice: 120,
    priceVariance: 0.40,
    availability: 0.70,
    maxStock: 10,
    highPriceMsg: "Raiders cleared out the local Psycho supply.",
    lowPriceMsg: "Surplus Psycho hit the market from a Super Mutant camp.",
    description: "Military-grade combat drug. Rage in a syringe.",
  },
  medx: {
    id: 'medx',
    name: 'Med-X',
    basePrice: 150,
    priceVariance: 0.25,
    availability: 0.65,
    maxStock: 8,
    highPriceMsg: "The Institute's been buying Med-X in bulk.",
    lowPriceMsg: "Caravan brought in a shipment — Med-X is on sale.",
    description: "Morphine derivative. Treats pain, creates dependency.",
  },
  buffout: {
    id: 'buffout',
    name: 'Buffout',
    basePrice: 100,
    priceVariance: 0.30,
    availability: 0.75,
    maxStock: 12,
    highPriceMsg: "Super Mutants cornered the Buffout market again.",
    lowPriceMsg: "Pre-war stockpile found — Buffout prices tanked.",
    description: "Anabolic steroid cocktail. Strength and endurance boost.",
  },
  mentats: {
    id: 'mentats',
    name: 'Mentats',
    basePrice: 90,
    priceVariance: 0.30,
    availability: 0.70,
    maxStock: 10,
    highPriceMsg: "Diamond City traders buying Mentats hand over fist.",
    lowPriceMsg: "Mentats recipe leaked — prices dropped hard.",
    description: "Cognitive enhancers. Beloved by merchants and hackers.",
  },
  radx: {
    id: 'radx',
    name: 'Rad-X',
    basePrice: 60,
    priceVariance: 0.20,
    availability: 0.80,
    maxStock: 20,
    highPriceMsg: "Glowing Sea explorers cleaned out all the Rad-X.",
    lowPriceMsg: "Rad-X flowing cheap after a Vault-Tec cache was cracked open.",
    description: "Radiation resistance pill. Ubiquitous in the wasteland.",
  },
  radaway: {
    id: 'radaway',
    name: 'RadAway',
    basePrice: 75,
    priceVariance: 0.25,
    availability: 0.75,
    maxStock: 15,
    highPriceMsg: "Radiation spike sent RadAway prices sky-high.",
    lowPriceMsg: "Synth scavengers flooded the market with RadAway.",
    description: "Radiation flush solution. Essential for survivors.",
  },
  stimpak: {
    id: 'stimpak',
    name: 'Stimpak',
    basePrice: 200,
    priceVariance: 0.20,
    availability: 0.60,
    maxStock: 6,
    highPriceMsg: "Railroad and BoS are buying every Stimpak in sight.",
    lowPriceMsg: "A factory found intact — Stimpaks are rock bottom.",
    description: "Healing nanomachine injection. The most valuable chem.",
  },
  ultrajet: {
    id: 'ultrajet',
    name: 'Ultrajet',
    basePrice: 350,
    priceVariance: 0.50,
    availability: 0.25,
    maxStock: 4,
    highPriceMsg: "Word is the Ultrajet recipe is a state secret — prices soaring.",
    lowPriceMsg: "A wandering chemist undercut everyone — Ultrajet cheap today.",
    description: "Refined Jet. Rarer and far more potent.",
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
  },
}

export const CHEM_IDS = Object.keys(CHEMS)
