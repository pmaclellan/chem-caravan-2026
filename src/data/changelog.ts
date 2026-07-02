export interface ChangelogEntry {
  version: string
  date: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.1',
    date: 'Jul 2, 2026',
    items: [
      'Achievement system — earn XP and badges for combat, trading, exploration, and survival milestones',
      'Dossier — view your full stats and earned achievements mid-run',
      '15+ achievements at launch: Pacifist, Toll Evader, Butt Clencher, Friends with Benefits, Bear Tamer, and more',
      'Achievement toasts cycle through multiple unlocks with a progress bar',
      'Debt freedom modal and XP bonus when you clear your loan',
      'Settlement discovery splash with typewriter reveal on first visit',
      'Net worth scoring for Standard mode: caps + inventory value + gear − debt',
      'Animated game over screen with full XP breakdown',
      'Taming mini-game difficulty increased across all tools',
      'Price colors have sharper contrast between the expensive and very-expensive tiers',
      'Character name auto-fills from your last run in each region',
    ],
  },
  {
    version: '1.0.1',
    date: 'Jun 30, 2026',
    items: [
      'XP shown as a secondary stat on Standard mode leaderboard entries',
      'Password recovery via email',
      'Guards can fight even when you carry no gun',
      'Mobile UI clarity: caps in blue, cleaner payroll and pack value labels',
    ],
  },
  {
    version: '1.0.0',
    date: 'Jun 29, 2026',
    items: [
      'Initial release',
      'Three regions: Commonwealth (easy), Capital Wasteland (medium), Mojave Wasteland (hard)',
      'Standard mode (30 turns, net worth scoring) and Free Play (no limit, XP scoring)',
      'Weapons, armor, guards, brahmin, and Power Armor guards',
      'Per-settlement market conditions and stock modifiers',
      'Dynamic combat with burst fire, splash damage, and stray shots',
      'Creature taming mini-game in Free Play — Yao Guai, Radscorpion, Deathclaw',
    ],
  },
]
