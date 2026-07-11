export interface ChangelogEntry {
  version: string
  date: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.1',
    date: 'Jul 11, 2026',
    items: [
      'Fixed the debt collector payment window: the caps you were told to pay could quietly fall short as interest compounded, occasionally leading to a fatal visit right after paying up — the target now stays fixed for the window it was shown for',
      'A payment that clears the window now eases the collector\'s temper (one warning walked back), instead of leaving you one hit from death forever after two prior visits',
    ],
  },
  {
    version: '1.2.0',
    date: 'Jul 9, 2026',
    items: [
      'Combat overhaul: guards and Power Armor guards now have individual, persistent HP that carries wounded across waves and encounters, healing free at any settlement doctor — replaces the old pooled damage-absorption system',
      'Every attack (yours, your guards\', the enemy\'s) now targets and rolls to-hit independently, including a real miss chance for enemies — no more guaranteed hits',
      'Guard classes: Standard, Shotgunner (buckshot spray hits multiple enemies), Sniper (heavy damage, 1-turn reload), and Medic (grants your party extra Field Medicine uses per round)',
      'Usable combat chems — Stimpak, Jet, and Ultrajet can be applied mid-fight without spending your turn, up to a per-round cap raised by Medics',
      'Free Play: 3rd and 4th combat waves can now chain in on high-danger roads past turn 50/75',
      'Settlement chem stock depletes when you buy it out and recovers gradually over turns away, with a "recovering ~Nt" indicator',
      'Dismiss guards, Power Armor guards, and mounts from your roster (no refund)',
      'Sell brahmin, guns, and armor back for half price — a real way to shed brahmin once they become a late-game liability',
      'New Sniper Rifle (Commonwealth) and Double-Barrel Shotgun rework (Commonwealth + Capital Wasteland, fires both barrels then reloads)',
      'Anti-Materiel Rifle (Mojave) and Laser Musket (Commonwealth) retuned so neither dominates its region\'s weapon lineup',
      'Four new guns: Chinese Assault Rifle and Gauss Rifle (Capital Wasteland), Grenade Rifle and Silenced .22 Pistol (Mojave)',
      'Field Medicine redesigned — arm a chem, then click a glowing protector card directly to apply it',
      'Reload and buff status now show as small icon badges on protector cards, timed to each unit\'s own animation',
      'Per-guard-class icons shown during combat',
      '"Needs Power Armor" now shown clearly in red only when unmet, replacing a cryptic tag that read as needing Power Armor guards instead of wearing your own suit',
      'Mobile market events now show turns remaining, matching desktop',
      'Cazador plural spelling corrected (Cazadores) throughout',
      'Market panel: stock column no longer shifts when a "recovering" notice appears',
      'Netlify deploys now run the test suite first',
      'Subtle build/deploy version stamp on desktop and in the mobile Player tab, to confirm a fresh deploy went out',
    ],
  },
  {
    version: '1.1.1',
    date: 'Jul 4, 2026',
    items: [
      'Achievement system — earn XP and badges for combat, trading, exploration, and survival milestones',
      'Dossier — view your full stats and earned achievements mid-run',
      '28 achievements: Pacifist, Toll Evader, Butt Clencher, Free and Clear, Bear Tamer, and more',
      'Achievement cards show description and earned-turn badge; most recently earned shown first',
      'Achievement toasts cycle through multiple unlocks with a progress bar',
      'XP breakdown by source (combat, achievements, trade, travel) on game over, dossier, and leaderboard',
      'Free and Clear achievement (500 XP) for paying off your debt entirely',
      'WHAT\'S NEW changelog accessible from the main menu',
      'Stats dossier: payroll paid, XP by source, kill detail by enemy type, and cleaner layout',
      'Debt freedom modal visual polish',
      'Settlement discovery splash with typewriter reveal on first visit',
      'Net worth scoring for Standard mode: caps + inventory value + gear − debt',
      'Animated game over screen with achievement badges and XP breakdown',
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
