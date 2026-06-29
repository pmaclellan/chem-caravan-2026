export interface Settlement {
  id: string
  name: string
  description: string
  faction: string
  hasDoctor: boolean
  hasLoanshark: boolean
  hasArmory: boolean
  hasFollowers: boolean
  doctorCost: number    // caps to heal fully
  imageUrl: string | null
  priceModifier?: number        // multiplier on all chem prices (e.g. 0.80 = 20% cheaper)
  stockMultiplier?: number      // multiplier on max stock per chem (e.g. 2.0 = up to 2× normal quantity)
  availabilityBonus?: number    // flat bonus added to each chem's availability roll (e.g. 0.20 = 20% more likely to be in stock)
}

export interface Road {
  id: string
  name: string
  from: string
  to: string
  dangerLevel: number   // 0-1, direct probability of a combat encounter per trip
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
    hasArmory: true,
    hasFollowers: true,
    doctorCost: 200,
    imageUrl: '/assets/settlements/commonwealth/diamond_city.webp',
  },
  goodneighbor: {
    id: 'goodneighbor',
    name: 'Goodneighbor',
    description: "No rules, no law, no problem. If you've got caps.",
    faction: 'Triggermen',
    hasDoctor: true,
    hasLoanshark: true,
    hasArmory: true,
    hasFollowers: true,
    doctorCost: 150,
    imageUrl: '/assets/settlements/commonwealth/goodneighbor.webp',
  },
  park_street_station: {
    id: 'park_street_station',
    name: 'Park Street Station',
    description: "Vault 114 entrance. Mob-controlled underground hub.",
    faction: 'Triggermen',
    hasDoctor: false,
    hasLoanshark: true,

    hasArmory: true,
    hasFollowers: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/park_street_station.webp',
  },
  bunker_hill: {
    id: 'bunker_hill',
    name: 'Bunker Hill',
    description: "Major trading post. All factions tolerated for business.",
    faction: 'Independent',
    hasDoctor: false,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: true,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/bunker_hill.webp',
  },
  covenant: {
    id: 'covenant',
    name: 'Covenant',
    description: "A closed off community. Oddly well kept.",
    faction: 'Independent',
    hasDoctor: true,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: false,
    doctorCost: 300,
    imageUrl: '/assets/settlements/commonwealth/covenant.webp',
  },
  sanctuary_hills: {
    id: 'sanctuary_hills',
    name: 'Sanctuary Hills',
    description: "Pre-war suburb turned Minutemen settlement. Quiet.",
    faction: 'Minutemen',
    hasDoctor: false,
    hasLoanshark: false,
    hasArmory: false,
    hasFollowers: true,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/sanctuary_hills.webp',
    priceModifier: 1.10,
  },
  concord: {
    id: 'concord',
    name: 'Concord',
    description: "City ruins. Raiders and Minutemen clash here frequently.",
    faction: 'Minutemen',
    hasDoctor: false,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: true,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/concord.webp',
  },
  cambridge_police_station: {
    id: 'cambridge_police_station',
    name: 'Cambridge Police Station',
    description: "Fortified Brotherhood of Steel outpost.",
    faction: 'Brotherhood of Steel',
    hasDoctor: true,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: false,
    doctorCost: 250,
    imageUrl: '/assets/settlements/commonwealth/cambridge_police_station.webp',
  },
  the_castle: {
    id: 'the_castle',
    name: 'The Castle',
    description: "Minutemen fortress. Orderly but sparse.",
    faction: 'Minutemen',
    hasDoctor: true,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: true,
    doctorCost: 100,
    imageUrl: '/assets/settlements/commonwealth/the_castle.webp',
    priceModifier: 1.20,
  },
  vault_81: {
    id: 'vault_81',
    name: 'Vault 81',
    description: "Functioning Vault. Rare goods flow in and out.",
    faction: 'Vault',
    hasDoctor: true,
    hasLoanshark: false,
    hasArmory: false,
    hasFollowers: false,
    doctorCost: 100,
    imageUrl: '/assets/settlements/commonwealth/vault_81.jpg',
  },
  jamaica_plain: {
    id: 'jamaica_plain',
    name: 'Jamaica Plain',
    description: "Dangerous ruins. High risk, high reward trading.",
    faction: 'Raiders',
    hasDoctor: false,
    hasLoanshark: false,
    hasArmory: true,
    hasFollowers: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/jamaica_plain.webp',
  },
  somerville_place: {
    id: 'somerville_place',
    name: 'Somerville Place',
    description: "Small farm settlement on the edge of the wastes.",
    faction: 'Independent',
    hasDoctor: false,
    hasLoanshark: false,
    hasArmory: false,
    hasFollowers: false,
    doctorCost: 0,
    imageUrl: '/assets/settlements/commonwealth/somerville_place.webp',
    priceModifier: 1.50,
  }
}

// All roads are bidirectional — the engine traverses both from→to and to→from
export const ROADS: Road[] = [
  {
    id: 'pss_gn',
    name: 'Combat Zone Alley',
    from: 'park_street_station',
    to: 'goodneighbor',
    dangerLevel: 0.54,
    description: "Short route through derelict combat zone territory.",
    enemyWeights: { super_mutant: 3, raider: 2 },
  },
  {
    id: 'dc_pss',
    name: 'Abandoned Subway Tunnel',
    from: 'diamond_city',
    to: 'park_street_station',
    dangerLevel: 0.48,
    description: "Underground passage. Ghouls haunt the dark stretches.",
    enemyWeights: { feral_ghoul: 3, raider: 1 },
  },
  {
    id: 'dc_jp',
    name: 'South Boston Freeway',
    from: 'diamond_city',
    to: 'jamaica_plain',
    dangerLevel: 0.56,
    description: "Exposed highway run through raider-heavy south Boston.",
  },
  {
    id: 'dc_cps',
    name: 'Memorial Bridge Road',
    from: 'diamond_city',
    to: 'cambridge_police_station',
    dangerLevel: 0.32,
    description: "Relatively safe merchant road. Caravans run this daily.",
  },
  {
    id: 'dc_v81',
    name: 'Storrow Drive',
    from: 'diamond_city',
    to: 'vault_81',
    dangerLevel: 0.48,
    description: "Along the Charles River. Gunners patrol this stretch.",
    enemyWeights: { raider: 4, yao_guai: 1 },
  },
  {
    id: 'sp_v81',
    name: 'Yankee Divisional Highway',
    from: 'somerville_place',
    to: 'vault_81',
    dangerLevel: 0.58,
    description: "Down the old Yankee Divisional Highway. Bit of a nasty route.",
    enemyWeights: { raider: 2, yao_guai: 3 },
  },
  {
    id: 'gn_bh',
    name: 'North End Passage',
    from: 'goodneighbor',
    to: 'bunker_hill',
    dangerLevel: 0.28,
    description: "North End streets. Reasonably patrolled by Triggermen.",
  },
  {
    id: 'sh_con',
    name: 'Lexington Bypass',
    from: 'sanctuary_hills',
    to: 'concord',
    dangerLevel: 0.44,
    description: "Through Lexington ruins. Feral ghouls are common.",
    enemyWeights: { feral_ghoul: 3, raider: 1 , yao_guai: 1 },
  },
  {
    id: 'sh_cov',
    name: 'Oberland Station Road',
    from: 'sanctuary_hills',
    to: 'covenant',
    dangerLevel: 0.24,
    description: "Farmland route. Relatively open and safe.",
  },
  {
    id: 'bh_cov',
    name: 'I-93',
    from: 'bunker_hill',
    to: 'covenant',
    dangerLevel: 0.24,
    description: "Up the old interstate. Relatively open and safe.",
  },
  {
    id: 'tc_jp',
    name: 'Coastal Highway',
    from: 'the_castle',
    to: 'jamaica_plain',
    dangerLevel: 0.52,
    description: "Coastal road through raider territory.",
  },
  {
    id: 'bh_cps',
    name: 'Memorial Drive',
    from: 'bunker_hill',
    to: 'cambridge_police_station',
    dangerLevel: 0.32,
    description: "Relatively safe merchant road. Caravans run this daily.",
  },
  {
    id: 'con_cps',
    name: 'Route 2',
    from: 'concord',
    to: 'cambridge_police_station',
    dangerLevel: 0.42,
    description: "Out through the wastes to the old Concord Ruins.",
  },
]

export const SETTLEMENT_IDS = Object.keys(SETTLEMENTS)
