export interface GunDefinition {
  id: string
  name: string
  price: number
  accuracy: number
  damage: number
  ammoPerShot: number
  ammoPrice: number        // caps per round
  ammoWithPurchase: number // rounds included when buying
  shotsPerTurn?: number    // fires this many shot rolls per trigger pull (minigun)
  cooldownTurns?: number   // turns of reload after firing (missile launcher)
  splashRatios?: number[]  // on hit: apply these fractions of base damage to subsequent alive enemies
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
    ammoPrice: 3,
    ammoWithPurchase: 30,
    description: "Cheapest thing that shoots. Better than nothing.",
  },
  pistol_10mm: {
    id: 'pistol_10mm',
    name: '10mm Pistol',
    price: 450,
    accuracy: 0.70,
    damage: 40,
    ammoPerShot: 1,
    ammoPrice: 5,
    ammoWithPurchase: 25,
    description: "Commonwealth standard sidearm. Reliable.",
  },
  combat_shotgun: {
    id: 'combat_shotgun',
    name: 'Combat Shotgun',
    price: 800,
    accuracy: 0.65,
    damage: 75,
    ammoPerShot: 2,
    ammoPrice: 10,
    ammoWithPurchase: 20,
    description: "Devastating at close range. Burns through ammo.",
  },
  combat_rifle: {
    id: 'combat_rifle',
    name: 'Combat Rifle',
    price: 1000,
    accuracy: 0.75,
    damage: 65,
    ammoPerShot: 1,
    ammoPrice: 8,
    ammoWithPurchase: 20,
    description: "Well-rounded workhorse. More punch than a pistol, more control than a shotgun.",
  },
  laser_rifle: {
    id: 'laser_rifle',
    name: 'Laser Rifle',
    price: 1200,
    accuracy: 0.90,
    damage: 50,
    ammoPerShot: 1,
    ammoPrice: 8,
    ammoWithPurchase: 20,
    description: "Energy weapon. High precision, no recoil. Misses are rare.",
  },
  laser_musket: {
    id: 'laser_musket',
    name: 'Laser Musket',
    price: 1500,
    accuracy: 0.45,
    damage: 130,
    ammoPerShot: 2,
    ammoPrice: 15,
    ammoWithPurchase: 12,
    description: "Crank-powered Institute reject. Wildly inaccurate, but a hit puts anything down.",
  },
  minigun: {
    id: 'minigun',
    name: 'Minigun',
    price: 2200,
    accuracy: 0.35,
    damage: 40,
    ammoPerShot: 3,
    shotsPerTurn: 3,
    ammoPrice: 4,
    ammoWithPurchase: 60,
    description: "Fires three rounds per pull. Rarely hits with all three. When it does, nothing survives.",
  },
  missile_launcher: {
    id: 'missile_launcher',
    name: 'Missile Launcher',
    price: 2800,
    accuracy: 0.80,
    damage: 220,
    ammoPerShot: 1,
    cooldownTurns: 2,
    splashRatios: [0.30, 0.20, 0.10],
    ammoPrice: 60,
    ammoWithPurchase: 5,
    description: "One shot, massive damage. Blast wave hits nearby enemies. Two turns to reload.",
  },
}

export const GUN_IDS = Object.keys(GUNS)
