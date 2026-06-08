export interface Settlement {
  id: string
  name: string
  description: string
  faction: string
  hasDoctor: boolean
  hasLoanshark: boolean
  hasBank: boolean
  hasGunShop: boolean
  hasGuards: boolean
  hasBrahminMarket: boolean
  doctorCost: number    // caps to heal fully
  imageUrl: string | null
}

export interface Road {
  id: string
  name: string
  from: string
  to: string
  travelCost: number    // caps deducted on travel
  dangerLevel: number   // 0-1, drives event probability
  description: string
  enemyWeights?: Partial<Record<string, number>>  // relative spawn weights; equal weight if absent
}

export const SETTLEMENTS: Record<string, Settlement> = {
  diamond_city: {
    id: 'diamond_city',
    name: 'Diamond City',
    description: "The Great Green Jewel. Safest place in the Commonwealth.",
    faction: 'Independent',
    hasDoctor: true,
    hasLoanshark: true,
    hasBank: true,
    hasGunShop: true,
    hasGuards: true,
    hasBrahminMarket: true,
    doctorCost: 200,
    imageUrl: '/assets/settlements/diamond_city.webp',
  },
  goodneighbor: {
    id: 'goodneighbor',
    name: 'Goodneighbor',
    description: "No rules, no law, no problem. If you've got caps.",
    faction: 'Triggermen',
    hasDoctor: true,
    hasLoanshark: true,
    hasBank: false,
    hasGunShop: true,
    hasGuards: true,
    hasBrahminMarket: false,
    doctorCost: 150,
    imageUrl: '/assets/settlements/goodneighbor.webp',
  },
  bunker_hill: {
    id: 'bunker_hill',
    name: 'Bunker Hill',
    description: "Major trading post. All factions tolerated for business.",
    faction: 'Independent',
    hasDoctor: false,
    hasLoanshark: true,
    hasBank: true,
    hasGunShop: false,
    hasGuards: true,
    hasBrahminMarket: true,
    doctorCost: 0,
    imageUrl: '/assets/settlements/bunker_hill.webp',
  },
  the_castle: {
    id: 'the_castle',
    name: 'The Castle',
    description: "Minutemen fortress. Orderly but sparse.",
    faction: 'Minutemen',
    hasDoctor: true,
    hasLoanshark: false,
    hasBank: false,
    hasGunShop: true,
    hasGuards: true,
    hasBrahminMarket: false,
    doctorCost: 100,
    imageUrl: '/assets/settlements/the_castle.webp',
  },
  vault_81: {
    id: 'vault_81',
    name: 'Vault 81',
    description: "Functioning Vault. Rare goods flow in and out.",
    faction: 'Vault',
    hasDoctor: true,
    hasLoanshark: false,
    hasBank: false,
    hasGunShop: false,
    hasGuards: false,
    hasBrahminMarket: false,
    doctorCost: 100,
    imageUrl: '/assets/settlements/vault_81.jpg',
  },
  sanctuary_hills: {
    id: 'sanctuary_hills',
    name: 'Sanctuary Hills',
    description: "Pre-war suburb turned Minutemen settlement. Quiet.",
    faction: 'Minutemen',
    hasDoctor: false,
    hasLoanshark: false,
    hasBank: false,
    hasGunShop: false,
    hasGuards: false,
    hasBrahminMarket: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/sanctuary_hills.webp',
  },
  graygarden: {
    id: 'graygarden',
    name: 'Graygarden',
    description: "Robot-run farm. Humans not particularly welcome.",
    faction: 'Robots',
    hasDoctor: false,
    hasLoanshark: false,
    hasBank: false,
    hasGunShop: false,
    hasGuards: false,
    hasBrahminMarket: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/graygarden.jpg',
  },
  jamaica_plain: {
    id: 'jamaica_plain',
    name: 'Jamaica Plain',
    description: "Dangerous ruins. High risk, high reward trading.",
    faction: 'Raiders',
    hasDoctor: false,
    hasLoanshark: false,
    hasBank: false,
    hasGunShop: true,
    hasGuards: false,
    hasBrahminMarket: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/jamaica_plain.webp',
  },
  park_street_station: {
    id: 'park_street_station',
    name: 'Park Street Station',
    description: "Vault 114 entrance. Mob-controlled underground hub.",
    faction: 'Triggermen',
    hasDoctor: false,
    hasLoanshark: true,
    hasBank: false,
    hasGunShop: true,
    hasGuards: false,
    hasBrahminMarket: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/park_street_station.webp',
  },
}

// All roads are bidirectional — the engine traverses both from→to and to→from
export const ROADS: Road[] = [
  {
    id: 'dc_gn',
    name: 'Combat Zone Alley',
    from: 'diamond_city',
    to: 'goodneighbor',
    travelCost: 50,
    dangerLevel: 0.55,
    description: "Short route through derelict combat zone territory.",
  },
  {
    id: 'dc_pss',
    name: 'Abandoned Subway Tunnel',
    from: 'diamond_city',
    to: 'park_street_station',
    travelCost: 40,
    dangerLevel: 0.60,
    description: "Underground passage. Ghouls haunt the dark stretches.",
  },
  {
    id: 'dc_jp',
    name: 'South Boston Freeway',
    from: 'diamond_city',
    to: 'jamaica_plain',
    travelCost: 60,
    dangerLevel: 0.70,
    description: "Exposed highway run through raider-heavy south Boston.",
  },
  {
    id: 'dc_bh',
    name: 'Memorial Bridge Road',
    from: 'diamond_city',
    to: 'bunker_hill',
    travelCost: 55,
    dangerLevel: 0.40,
    description: "Relatively safe merchant road. Caravans run this daily.",
  },
  {
    id: 'gn_pss',
    name: "Triggermen's Row",
    from: 'goodneighbor',
    to: 'park_street_station',
    travelCost: 30,
    dangerLevel: 0.45,
    description: "Short hop between Triggermen territory nodes.",
  },
  {
    id: 'gn_bh',
    name: 'North End Passage',
    from: 'goodneighbor',
    to: 'bunker_hill',
    travelCost: 45,
    dangerLevel: 0.35,
    description: "North End streets. Reasonably patrolled by Triggermen.",
  },
  {
    id: 'bh_sh',
    name: 'Route 3 North',
    from: 'bunker_hill',
    to: 'sanctuary_hills',
    travelCost: 70,
    dangerLevel: 0.50,
    description: "Long haul north on pre-war Route 3.",
  },
  {
    id: 'bh_gg',
    name: 'Lexington Bypass',
    from: 'bunker_hill',
    to: 'graygarden',
    travelCost: 65,
    dangerLevel: 0.55,
    description: "Through Lexington ruins. Feral ghouls are common.",
  },
  {
    id: 'sh_gg',
    name: 'Oberland Station Road',
    from: 'sanctuary_hills',
    to: 'graygarden',
    travelCost: 50,
    dangerLevel: 0.30,
    description: "Farmland route. Relatively open and safe.",
  },
  {
    id: 'sh_v81',
    name: 'Country Route 81',
    from: 'sanctuary_hills',
    to: 'vault_81',
    travelCost: 80,
    dangerLevel: 0.60,
    description: "Western wilderness route. Gunners patrol this stretch.",
  },
  {
    id: 'v81_tc',
    name: 'Quincy Ruins Road',
    from: 'vault_81',
    to: 'the_castle',
    travelCost: 90,
    dangerLevel: 0.75,
    description: "Brutal southern route. Quincy is Gunner-held.",
  },
  {
    id: 'tc_jp',
    name: 'Coastal Highway',
    from: 'the_castle',
    to: 'jamaica_plain',
    travelCost: 55,
    dangerLevel: 0.65,
    description: "Coastal road through raider territory.",
  },
]

export const SETTLEMENT_IDS = Object.keys(SETTLEMENTS)
