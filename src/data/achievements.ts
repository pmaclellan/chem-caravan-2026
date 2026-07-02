import type { AchievementDef } from '../types/achievement'

// Canonical order: Survival → Combat → Evasion → Taming → Trading → Exploration → Economy
// Earned achievements display earliest-first; locked follow this order.
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Survival ──────────────────────────────────────────────────────────────
  {
    id: 'survive_30',
    name: 'Thirty Turns',
    description: 'Survive 30 turns.',
    icon: 'heart-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'survive_50',
    name: 'Half a Hundred',
    description: 'Survive 50 turns.',
    icon: 'wave-pulse-svgrepo-com.svg',
    xpReward: 250,
  },
  {
    id: 'survive_75',
    name: 'Road Veteran',
    description: 'Survive 75 turns.',
    icon: 'sparkles-svgrepo-com.svg',
    xpReward: 500,
  },
  {
    id: 'survive_100',
    name: 'Century Run',
    description: 'Survive 100 turns.',
    icon: 'trophy-svgrepo-com.svg',
    xpReward: 750,
  },

  // ── Combat ────────────────────────────────────────────────────────────────
  {
    id: 'toll_collector',
    name: 'Toll Evader',
    description: 'Defeat a Brotherhood or NCR checkpoint instead of paying the toll.',
    icon: 'shield-armor-svgrepo-com.svg',
    xpReward: 500,
  },
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first combat.',
    icon: 'skull-alt-svgrepo-com.svg',
    xpReward: 50,
  },
  {
    id: 'second_wave',
    name: 'Second Wave',
    description: 'Defeat a second wave of enemies on a dangerous road.',
    icon: 'crosshair-svgrepo-com.svg',
    xpReward: 200,
  },
  {
    id: 'kill_all_enemies',
    name: 'Extinction Event',
    description: 'Kill at least one of every enemy type in this region.',
    icon: 'skull-crossbones-svgrepo-com.svg',
    xpReward: 250,
  },
  {
    id: 'butt_clencher',
    name: 'Butt Clencher',
    description: 'Escape combat (win or flee) with less than 10 HP and no armor left.',
    icon: 'heart-crack-svgrepo-com.svg',
    xpReward: 300,
  },

  // ── Pacifism ─────────────────────────────────────────────────────────────
  {
    id: 'pacifist',
    name: 'Pacifist',
    description: 'Go 10 consecutive turns without entering combat.',
    icon: 'handshake-svgrepo-com.svg',
    xpReward: 200,
  },

  // ── Evasion ───────────────────────────────────────────────────────────────
  {
    id: 'flee_10',
    name: 'Quick on Your Feet',
    description: 'Successfully flee from combat 10 times.',
    icon: 'circle-location-arrow-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'flee_50',
    name: 'Ghost of the Wasteland',
    description: 'Successfully flee from combat 50 times.',
    icon: 'signs-post-svgrepo-com.svg',
    xpReward: 250,
  },

  // ── Taming ────────────────────────────────────────────────────────────────
  {
    id: 'tame_yao_guai',
    name: 'Bear Tamer',
    description: 'Tame a Yao Guai.',
    icon: 'bear-svgrepo-com.svg',
    xpReward: 150,
  },
  {
    id: 'tame_radscorpion',
    name: 'Venom Wrangler',
    description: 'Tame a Radscorpion.',
    icon: 'scorpion-svgrepo-com.svg',
    xpReward: 200,
    modeFilter: ['capital_wasteland', 'mojave_wasteland'],
  },
  {
    id: 'tame_deathclaw',
    name: 'Death Defied',
    description: 'Tame a Deathclaw.',
    icon: 'crown-svgrepo-com.svg',
    xpReward: 250,
    modeFilter: ['mojave_wasteland'],
  },
  {
    id: 'tame_all_three',
    name: 'Beast Master',
    description: 'Tame a Yao Guai, a Radscorpion, and a Deathclaw in the same run.',
    icon: 'trophy-svgrepo-com.svg',
    xpReward: 500,
    modeFilter: ['mojave_wasteland'],
  },

  // ── Trading ───────────────────────────────────────────────────────────────
  {
    id: 'profit_100',
    name: 'Double or Nothing',
    description: 'Make 100% profit on a single trade (excluding found items).',
    icon: 'chart-line-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'profit_1000',
    name: 'Black Market King',
    description: 'Make 1000% profit on a single trade (excluding found items).',
    icon: 'briefcase-dollar-svgrepo-com.svg',
    xpReward: 300,
  },
  {
    id: 'opportunist',
    name: 'Opportunist',
    description: 'Sell chems to a desperate buyer at a premium.',
    icon: 'coins-alt-svgrepo-com.svg',
    xpReward: 150,
  },
  {
    id: 'sell_merchant',
    name: 'Back Alley Deal',
    description: 'Sell chems to a wandering merchant.',
    icon: 'scale-unbalanced-svgrepo-com.svg',
    xpReward: 50,
  },
  {
    id: 'drug_lord',
    name: 'Drug Lord',
    description: 'Sell 100 units of a single chem type across a run.',
    icon: 'scale-balanced-svgrepo-com.svg',
    xpReward: 200,
  },
  {
    id: 'all_chems_traded',
    name: 'Full Formulary',
    description: 'Buy and sell every type of chem available in this region.',
    icon: 'capsule-svgrepo-com.svg',
    xpReward: 100,
  },

  // ── Exploration ───────────────────────────────────────────────────────────
  {
    id: 'all_settlements',
    name: 'Well Traveled',
    description: 'Visit every settlement in the region.',
    icon: 'map-svgrepo-com.svg',
    xpReward: 100,
  },

  // ── Guards ────────────────────────────────────────────────────────────────
  {
    id: 'friends_with_benefits',
    name: 'Friends with Benefits',
    description: 'Win a fight with guards only — no gun or no ammo.',
    icon: 'followers-svgrepo-com.svg',
    xpReward: 150,
  },

  // ── Economy & Followers ───────────────────────────────────────────────────
  {
    id: 'buy_power_armor',
    name: 'Walking Tank',
    description: 'Purchase Power Armor.',
    icon: 'shield-armor-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'own_3_guns',
    name: 'Arsenal',
    description: 'Own 3 weapons simultaneously.',
    icon: 'award-alt-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'max_guards',
    name: 'Full Security Detail',
    description: 'Hire the maximum number of guards.',
    icon: 'soldier-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'max_pa_guards',
    name: 'Power Armored',
    description: 'Hire the maximum number of Power Armor guards.',
    icon: 'icons8-minigun-100.svg',
    xpReward: 150,
  },
  {
    id: 'max_brahmin',
    name: 'Full Herd',
    description: 'Own the maximum number of brahmin.',
    icon: 'cow-face-svgrepo-com.svg',
    xpReward: 100,
  },
  {
    id: 'max_all_followers',
    name: 'Ultimate Caravan',
    description: 'Max out guards, Power Armor guards, and brahmin simultaneously.',
    icon: 'tent-svgrepo-com.svg',
    xpReward: 300,
  },
]

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a])
)
