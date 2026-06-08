import type { GunDefinition } from '../commonwealth/guns'
export type { GunDefinition }

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
    description: "Standard wasteland sidearm. Reliable and common.",
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
  hunting_rifle: {
    id: 'hunting_rifle',
    name: 'Hunting Rifle',
    price: 1200,
    accuracy: 0.80,
    damage: 55,
    ammoPerShot: 1,
    description: "Bolt-action precision. Common in the Capital Wasteland.",
  },
}

export const GUN_IDS = Object.keys(GUNS)
export const AMMO_PRICE = 5
export const AMMO_WITH_PURCHASE = 20
