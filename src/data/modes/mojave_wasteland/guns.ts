import type { GunDefinition } from '../commonwealth/guns'
export type { GunDefinition }

export const GUNS: Record<string, GunDefinition> = {
  revolver_357: {
    id: 'revolver_357',
    name: '.357 Magnum',
    price: 250,
    accuracy: 0.60,
    damage: 30,
    ammoPerShot: 1,
    description: "Classic cowboy revolver. Hits hard for its size.",
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
  cowboy_repeater: {
    id: 'cowboy_repeater',
    name: 'Cowboy Repeater',
    price: 900,
    accuracy: 0.75,
    damage: 60,
    ammoPerShot: 1,
    description: "Lever-action carbine. Fast and accurate. Wasteland favorite.",
  },
  anti_materiel_rifle: {
    id: 'anti_materiel_rifle',
    name: 'Anti-Materiel Rifle',
    price: 1500,
    accuracy: 0.85,
    damage: 110,
    ammoPerShot: 1,
    description: "50 cal. Stops brahmin, deathclaws, and most things between.",
  },
}

export const GUN_IDS = Object.keys(GUNS)
export const AMMO_PRICE = 6
export const AMMO_WITH_PURCHASE = 20
