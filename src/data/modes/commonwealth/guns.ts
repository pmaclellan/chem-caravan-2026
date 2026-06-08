export interface GunDefinition {
  id: string
  name: string
  price: number
  accuracy: number      // 0-1 hit chance per shot
  damage: number        // HP damage per hit
  ammoPerShot: number   // ammo consumed per trigger pull
  description: string
}

export const GUNS: Record<string, GunDefinition> = {
  pipe_pistol: {
    id: 'pipe_pistol',
    name: 'Pipe Pistol',
    price: 200,
    accuracy: 0.55,
    damage: 25,
    ammoPerShot: 1,
    description: "Cheapest thing that shoots. Better than nothing.",
  },
  pistol_10mm: {
    id: 'pistol_10mm',
    name: '10mm Pistol',
    price: 450,
    accuracy: 0.70,
    damage: 40,
    ammoPerShot: 1,
    description: "Commonwealth standard sidearm. Reliable.",
  },
  combat_shotgun: {
    id: 'combat_shotgun',
    name: 'Combat Shotgun',
    price: 800,
    accuracy: 0.65,
    damage: 75,
    ammoPerShot: 2,
    description: "Devastating at close range. Burns through ammo.",
  },
  laser_rifle: {
    id: 'laser_rifle',
    name: 'Laser Rifle',
    price: 1200,
    accuracy: 0.80,
    damage: 60,
    ammoPerShot: 1,
    description: "Energy weapon. High precision, no recoil.",
  },
}

export const GUN_IDS = Object.keys(GUNS)
export const AMMO_PRICE = 5           // caps per round
export const AMMO_WITH_PURCHASE = 20  // rounds included when buying a gun
