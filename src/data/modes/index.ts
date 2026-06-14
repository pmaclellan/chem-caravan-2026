import type { EnemyType, GameModeId, ArmorDefinition } from '../../types/game'
import type { Settlement, Road } from './commonwealth/settlements'
import type { GunDefinition } from './commonwealth/guns'
import type { TravelEventDefinition } from './commonwealth/events'
import type { TransitQuote } from './commonwealth/quotes'
import { ARMORS, ARMOR_IDS } from '../armors'

import { SETTLEMENTS as CW_SETTLEMENTS, ROADS as CW_ROADS, SETTLEMENT_IDS as CW_SETTLEMENT_IDS } from './commonwealth/settlements'
import { GUNS as CW_GUNS, GUN_IDS as CW_GUN_IDS, AMMO_PRICE as CW_AMMO_PRICE, AMMO_WITH_PURCHASE as CW_AMMO_WITH_PURCHASE } from './commonwealth/guns'
import { TRAVEL_EVENT_DEFS as CW_EVENTS } from './commonwealth/events'
import { TRANSIT_QUOTES as CW_QUOTES } from './commonwealth/quotes'

import { SETTLEMENTS as CAP_SETTLEMENTS, ROADS as CAP_ROADS, SETTLEMENT_IDS as CAP_SETTLEMENT_IDS } from './capital_wasteland/settlements'
import { GUNS as CAP_GUNS, GUN_IDS as CAP_GUN_IDS, AMMO_PRICE as CAP_AMMO_PRICE, AMMO_WITH_PURCHASE as CAP_AMMO_WITH_PURCHASE } from './capital_wasteland/guns'
import { TRAVEL_EVENT_DEFS as CAP_EVENTS } from './capital_wasteland/events'
import { TRANSIT_QUOTES as CAP_QUOTES } from './capital_wasteland/quotes'

import { SETTLEMENTS as MOJ_SETTLEMENTS, ROADS as MOJ_ROADS, SETTLEMENT_IDS as MOJ_SETTLEMENT_IDS } from './mojave_wasteland/settlements'
import { GUNS as MOJ_GUNS, GUN_IDS as MOJ_GUN_IDS, AMMO_PRICE as MOJ_AMMO_PRICE, AMMO_WITH_PURCHASE as MOJ_AMMO_WITH_PURCHASE } from './mojave_wasteland/guns'
import { TRAVEL_EVENT_DEFS as MOJ_EVENTS } from './mojave_wasteland/events'
import { TRANSIT_QUOTES as MOJ_QUOTES } from './mojave_wasteland/quotes'

// Re-export shared types so consumers can import from one place
export type { Settlement, Road, GunDefinition, ArmorDefinition, TravelEventDefinition, TransitQuote }

export interface MapNodePosition {
  x: number
  y: number
  labelAnchor: 'middle' | 'start' | 'end'
  labelDx: number
  labelDy: number
}

export interface DebtEnforcementEntry {
  age: number
  damage: number
  message: string
}

export interface GameModeConfig {
  id: GameModeId
  name: string
  subtitle: string          // "Fallout 4", "Fallout 3", "Fallout: New Vegas"
  // economy
  interestRate: number
  startingCaps: number      // must always equal startingDebt
  startingDebt: number      // must always equal startingCaps
  maxTurns: number          // fixed at 30 across all modes
  startingHealth: number
  startingBrahmin: number
  baseCapacity: number
  capacityPerBrahmin: number
  debtEnforcement: DebtEnforcementEntry[]
  guardCost: number
  guardHealth: number       // HP absorbed per guard per attack as mitigation
  guardAccuracy: number     // hit chance for each guard's attack roll
  guardDamage: [number, number]
  maxGuards: number
  powerArmorGuardCost: number
  powerArmorGuardHealth: number
  maxPowerArmorGuards: number
  brahminCost: number
  maxBrahmin: number
  doctorCost: number
  doctorCostCheap: number
  // events
  nonCombatEventProb: number     // probability of a non-combat event when no ambush fires
  debtGracePeriod: number        // turns before any enforcement begins
  debtWindowSize: number         // turns in each payment window (player must pay 15% within the window)
  debtMinPaymentRate: number     // fraction of current debt required per payment window (cumulative)
  debtCollectorProb: number      // per-turn chance of visit when overdue (window closed without payment)
  // market
  marketEventProbPerTurn: number
  marketEventDurationMin: number
  marketEventDurationMax: number
  shortageMultiplierMin: number
  shortageMultiplierMax: number
  surplusMultiplierMin: number
  surplusMultiplierMax: number
  // enemies — identity/loot only; health/damage per enemy in enemyStats
  enemies: EnemyType[]
  enemyStats: Record<string, { health: number; damage: [number, number]; xpReward: number }>
  // chems available in this mode's markets (subset of global CHEMS registry)
  availableChemIds: string[]
  // world data — mode-specific settlements, roads, guns, armor
  settlements: Record<string, Settlement>
  settlementIds: string[]
  roads: Road[]
  guns: Record<string, GunDefinition>
  gunIds: string[]
  ammoPrice: number
  ammoWithPurchase: number
  armors: Record<string, ArmorDefinition>
  armorIds: string[]
  startingLocation: string
  travelEvents: TravelEventDefinition[]
  transitQuotes: TransitQuote[]
  mapPositions: Record<string, MapNodePosition>
  mapTitle: string
}

const COMMONWEALTH_MODE: GameModeConfig = {
  id: 'commonwealth',
  name: 'Commonwealth',
  subtitle: 'Fallout 4',
  interestRate: 0.05,
  startingCaps: 2000,
  startingDebt: 2000,
  maxTurns: 30,
  startingHealth: 100,
  startingBrahmin: 1,
  baseCapacity: 20,
  capacityPerBrahmin: 10,
  debtEnforcement: [
    { age: 5,  damage: 30,  message: "Triggermen thugs find you on the road. They rough you up as a reminder." },
    { age: 10, damage: 50,  message: "They're back, and less patient this time. They break two ribs." },
    { age: 12, damage: 999, message: "The last thing you see is the caps logo on a Triggerman's ring." },
  ],
  guardCost: 400,
  guardHealth: 50,
  guardAccuracy: 0.55,
  guardDamage: [20, 35],
  maxGuards: 5,
  powerArmorGuardCost: 2500,
  powerArmorGuardHealth: 150,
  maxPowerArmorGuards: 3,
  brahminCost: 250,
  maxBrahmin: 5,
  doctorCost: 200,
  doctorCostCheap: 100,
  nonCombatEventProb: 0.30,
  debtGracePeriod: 10,
  debtWindowSize: 4,
  debtMinPaymentRate: 0.15,   // pay 15% of current debt within each 4-turn window
  debtCollectorProb: 0.45,
  marketEventProbPerTurn: 0.15,
  marketEventDurationMin: 1,
  marketEventDurationMax: 2,
  shortageMultiplierMin: 2.0,
  shortageMultiplierMax: 4.0,
  surplusMultiplierMin: 0.25,
  surplusMultiplierMax: 0.55,
  enemies: [
    { id: 'raider',              name: 'Raider',               caps: [20, 150],   lootChems: ['jet', 'psycho', 'buffout', 'radx', 'radaway'] },
    { id: 'feral_ghoul',         name: 'Feral Ghoul',          caps: [0, 20],     lootChems: ['radaway', 'radx'], countMultiplier: 1.5 },
    { id: 'yao_guai',            name: 'Yao Guai',             caps: [0, 0],      lootChems: [] },
    { id: 'brotherhood_paladin', name: 'Brotherhood Paladin',  caps: [500, 1000], lootChems: ['stimpak', 'medx'], eventOnly: true },
  ],
  enemyStats: {
    raider:              { health: 40,  damage: [10, 30], xpReward: 15 },
    feral_ghoul:         { health: 20,  damage: [6, 16],  xpReward: 8  },
    yao_guai:            { health: 85,  damage: [28, 48], xpReward: 40 },
    brotherhood_paladin: { health: 130, damage: [30, 55], xpReward: 60 },
  },
  availableChemIds: ['jet', 'psycho', 'medx', 'buffout', 'mentats', 'radx', 'radaway', 'stimpak', 'ultrajet', 'daytripper'],
  settlements: CW_SETTLEMENTS,
  settlementIds: CW_SETTLEMENT_IDS,
  roads: CW_ROADS,
  guns: CW_GUNS,
  gunIds: CW_GUN_IDS,
  ammoPrice: CW_AMMO_PRICE,
  ammoWithPurchase: CW_AMMO_WITH_PURCHASE,
  armors: ARMORS,
  armorIds: ARMOR_IDS,
  startingLocation: 'diamond_city',
  travelEvents: CW_EVENTS,
  transitQuotes: CW_QUOTES,
  mapTitle: 'COMMONWEALTH WASTELAND',
  mapPositions: {
    sanctuary_hills:     { x: 160, y: 160, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    graygarden:          { x: 260, y: 160, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    bunker_hill:         { x: 360, y: 260, labelAnchor: 'start',  labelDx:  13, labelDy:  -5 },
    goodneighbor:        { x: 460, y: 260, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    park_street_station: { x: 460, y: 360, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    diamond_city:        { x: 360, y: 360, labelAnchor: 'middle', labelDx:   0, labelDy:  18 },
    vault_81:            { x: 160, y: 360, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    jamaica_plain:       { x: 260, y: 460, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
    the_castle:          { x: 460, y: 460, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
  },
}

const CAPITAL_WASTELAND_MODE: GameModeConfig = {
  ...COMMONWEALTH_MODE,
  id: 'capital_wasteland',
  name: 'Capital Wasteland',
  subtitle: 'Fallout 3',
  interestRate: 0.065,
  debtGracePeriod: 8,
  debtWindowSize: 3,
  debtMinPaymentRate: 0.15,   // pay 15% of current debt within each 3-turn window
  debtEnforcement: [
    { age: 5,  damage: 30,  message: "Talon Company mercs intercept you on the road. They beat you as a warning." },
    { age: 10, damage: 55,  message: "They're back, meaner. Two broken ribs and a missing tooth." },
    { age: 12, damage: 999, message: "The last thing you see is a Talon Company contract with your name on it." },
  ],
  enemies: [
    { id: 'raider',              name: 'Raider',               caps: [20, 150],   lootChems: ['jet', 'psycho', 'buffout', 'radx', 'radaway'] },
    { id: 'feral_ghoul',         name: 'Feral Ghoul',          caps: [0, 20],     lootChems: ['radaway', 'radx'], countMultiplier: 1.5 },
    { id: 'super_mutant',        name: 'Super Mutant',         caps: [10, 80],    lootChems: ['psycho', 'buffout', 'stimpak'] },
    { id: 'radscorpion',         name: 'Radscorpion',          caps: [0, 0],      lootChems: [] },
    { id: 'yao_guai',            name: 'Yao Guai',             caps: [0, 0],      lootChems: [] },
    { id: 'brotherhood_paladin', name: 'Brotherhood Paladin',  caps: [500, 1000], lootChems: ['stimpak', 'medx'], eventOnly: true },
  ],
  enemyStats: {
    raider:              { health: 45,  damage: [11, 32], xpReward: 15 },
    feral_ghoul:         { health: 20,  damage: [6, 16],  xpReward: 8  },
    super_mutant:        { health: 70,  damage: [15, 35], xpReward: 25 },
    radscorpion:         { health: 70,  damage: [20, 42], xpReward: 30 },
    yao_guai:            { health: 85,  damage: [28, 48], xpReward: 40 },
    brotherhood_paladin: { health: 130, damage: [30, 55], xpReward: 60 },
  },
  availableChemIds: ['jet', 'psycho', 'medx', 'buffout', 'mentats', 'radx', 'radaway', 'stimpak', 'ultrajet', 'nuka_cola_quantum'],
  settlements: CAP_SETTLEMENTS,
  settlementIds: CAP_SETTLEMENT_IDS,
  roads: CAP_ROADS,
  guns: CAP_GUNS,
  gunIds: CAP_GUN_IDS,
  ammoPrice: CAP_AMMO_PRICE,
  ammoWithPurchase: CAP_AMMO_WITH_PURCHASE,
  startingLocation: 'rivet_city',
  travelEvents: CAP_EVENTS,
  transitQuotes: CAP_QUOTES,
  mapTitle: 'CAPITAL WASTELAND',
  mapPositions: {
    canterbury_commons:  { x: 500, y: 100, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    paradise_falls:      { x: 200, y: 100, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    megaton:             { x: 300, y: 400, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    big_town:            { x: 360, y: 220, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    little_lamplight:    { x: 100, y: 260, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    tenpenny_tower:      { x: 200, y: 530, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    andale:              { x: 320, y: 560, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
    girdershade:         { x: 60, y: 500, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
    underworld:          { x: 520, y: 400, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    washington_monument: { x: 480, y: 430, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    rivet_city:          { x: 500, y: 500, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    the_citadel:         { x: 400, y: 460, labelAnchor: 'middle', labelDx:   0, labelDy:  18 },
  },
}

const MOJAVE_WASTELAND_MODE: GameModeConfig = {
  ...COMMONWEALTH_MODE,
  id: 'mojave_wasteland',
  name: 'Mojave Wasteland',
  subtitle: 'Fallout: New Vegas',
  interestRate: 0.08,
  debtGracePeriod: 5,
  debtWindowSize: 3,
  debtMinPaymentRate: 0.15,   // pay 15% of current debt within each 3-turn window
  debtCollectorProb: 0.60,
  debtEnforcement: [
    { age: 5,  damage: 35,  message: "Legion Assassins catch you on the road. They beat you and leave a coin." },
    { age: 10, damage: 60,  message: "They return. One crucifixion attempt. You narrowly escape." },
    { age: 12, damage: 999, message: "Caesar's debt collectors don't take prisoners." },
  ],
  enemies: [
    { id: 'fiend',        name: 'Fiend',        caps: [15, 100],   lootChems: ['jet', 'psycho', 'buffout', 'radx', 'radaway'] },
    { id: 'great_khan',   name: 'Great Khan',   caps: [20, 120],   lootChems: ['psycho', 'buffout', 'mentats'] },
    { id: 'legionnaire',  name: 'Legionnaire',  caps: [5, 50],     lootChems: ['stimpak', 'medx'] },
    { id: 'deathclaw',    name: 'Deathclaw',    caps: [0, 0],      lootChems: [] },
    { id: 'radscorpion',  name: 'Radscorpion',  caps: [0, 0],      lootChems: [] },
    { id: 'ncr_ranger',   name: 'NCR Ranger',   caps: [500, 1000], lootChems: ['stimpak', 'radx'], eventOnly: true },
  ],
  enemyStats: {
    fiend:       { health: 40,  damage: [10, 30], xpReward: 15 },
    great_khan:  { health: 55,  damage: [14, 32], xpReward: 20 },
    legionnaire: { health: 70,  damage: [22, 42], xpReward: 35 },
    deathclaw:   { health: 140, damage: [50, 90], xpReward: 80 },
    radscorpion: { health: 70,  damage: [20, 42], xpReward: 30 },
    ncr_ranger:  { health: 110, damage: [28, 50], xpReward: 50 },
  },
  availableChemIds: ['jet', 'psycho', 'medx', 'buffout', 'mentats', 'radx', 'radaway', 'stimpak', 'turbo', 'rocket'],
  settlements: MOJ_SETTLEMENTS,
  settlementIds: MOJ_SETTLEMENT_IDS,
  roads: MOJ_ROADS,
  guns: MOJ_GUNS,
  gunIds: MOJ_GUN_IDS,
  ammoPrice: MOJ_AMMO_PRICE,
  ammoWithPurchase: MOJ_AMMO_WITH_PURCHASE,
  startingLocation: 'the_strip',
  travelEvents: MOJ_EVENTS,
  transitQuotes: MOJ_QUOTES,
  mapTitle: 'MOJAVE WASTELAND',
  mapPositions: {
    jacobstown:    { x: 160, y: 260, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    freeside:      { x: 260, y: 160, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    the_strip:     { x: 360, y: 160, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
    goodsprings:   { x: 160, y: 360, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
    primm:         { x: 260, y: 360, labelAnchor: 'middle', labelDx:   0, labelDy:  18 },
    camp_mccarran: { x: 360, y: 260, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    boulder_city:  { x: 460, y: 260, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    novac:         { x: 460, y: 360, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
    the_fort:      { x: 360, y: 460, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
  },
}

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  commonwealth:      COMMONWEALTH_MODE,
  capital_wasteland: CAPITAL_WASTELAND_MODE,
  mojave_wasteland:  MOJAVE_WASTELAND_MODE,
}
