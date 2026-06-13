import type { ArmorDefinition } from '../types/game'

export const ARMORS: Record<string, ArmorDefinition> = {
  light_armor: {
    id: 'light_armor',
    name: 'Light Armor',
    price: 750,
    armorPoints: 30,
    repairCostPerAP: 3,
    description: 'Basic scavenged protection. Better than nothing.',
  },
  combat_armor: {
    id: 'combat_armor',
    name: 'Combat Armor',
    price: 2500,
    armorPoints: 75,
    repairCostPerAP: 4,
    description: 'Military-grade armor. Significantly reduces incoming damage.',
  },
  power_armor: {
    id: 'power_armor',
    name: 'Power Armor',
    price: 10000,
    armorPoints: 200,
    repairCostPerAP: 5,
    description: 'Pre-war powered exoskeleton. Near-impenetrable protection.',
  },
}

export const ARMOR_IDS = Object.keys(ARMORS)
