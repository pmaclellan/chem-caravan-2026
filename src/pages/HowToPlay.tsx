import { useNavigate } from 'react-router-dom'

export default function HowToPlayPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative flex flex-col items-center p-4">
      {/* Background — same as main menu */}
      <div className="fixed inset-0 z-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
          <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
        <div className="absolute inset-0 bg-pip-bg" style={{ opacity: 0.72 }} />
      </div>

      <div className="relative z-10 max-w-lg w-full py-2">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-4xl text-pip-green tracking-widest">HOW TO PLAY</h1>
          <button className="pip-btn" onClick={() => navigate('/')}>BACK</button>
        </div>

        <div className="pip-panel space-y-5 text-sm font-mono">

          <section>
            <div className="pip-label mb-1">Objective</div>
            <p className="text-pip-green-dim leading-relaxed">
              Buy and sell chems across the wasteland, pay off your starting debt, and turn a profit.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              <span className="text-pip-green">Standard</span> is an economic optimization puzzle
              with a deadline: 30 turns to build the highest net worth you can. Score = net worth
              (caps + inventory + weapons + armor − debt) plus XP earned. Invest in power armor and
              heavy weapons — they count toward your final score.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              <span className="text-pip-green">Free Play</span> has no turn limit. Score is purely
              XP earned — rewarding exploration, combat, discovery, and trade over the full length
              of your run. Net worth is shown on your end screen for context but doesn't affect rank.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Scoring</div>
            <p className="text-pip-green-dim leading-relaxed">
              <span className="text-pip-green">Standard score = net worth</span>, tallied at game end:
            </p>
            <ul className="text-pip-green-dim leading-relaxed mt-1 ml-4 space-y-0.5 list-none">
              <li>+ Caps on hand</li>
              <li>+ Inventory (chems at base price)</li>
              <li>+ Weapons (purchase price of all guns you own)</li>
              <li>+ Armor (proportional to current condition)</li>
              <li>− Debt remaining</li>
            </ul>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              Power armor and heavy weapons count as assets, not liabilities. There's no benefit
              to dumping your pack before the last turn — buy good gear and hold it.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              <span className="text-pip-green">Free Play score = XP only</span> — earned from
              travel, combat, settlement discovery, trading at a profit, and clearing debt.
              Net worth is shown on your end screen for context but doesn't affect rank.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Trading</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each settlement buys and sells at different prices. Buy low, sell high. Prices shift
              with market events — a shortage drives prices up (good time to sell), a surplus drives
              them down (good time to buy). Watch the log for event announcements.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              Prices are color-coded across their full historical range:{' '}
              <span className="text-pip-blue">blue</span> = unusually cheap (buy opportunity),
              dim = near base price, <span className="text-pip-amber">rust</span> = unusually
              expensive (sell opportunity). No value judgment — just position in the range.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Travel</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each trip advances the turn counter. Guard salary is deducted every turn — make sure
              you can cover it or guards start deserting. Each road has a danger rating: higher danger
              means more combat encounters and tougher enemies. Guards improve your combat odds and
              escape chance. Brahmin add pack capacity but make fleeing harder.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              Visiting a new settlement for the first time earns a discovery XP bonus.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Combat</div>
            <p className="text-pip-green-dim leading-relaxed">
              When ambushed, choose <span className="text-pip-green">FIGHT</span> or{' '}
              <span className="text-pip-green">RUN</span>. On FIGHT, your gun fires first (if you
              have one with ammo), then each guard fires their own sidearm — guards carry their own
              ammo and fire independently of yours. No gun? Your guards still fight on your behalf.
              Winning lets you loot caps and chems from the bodies.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-2">
              Incoming damage hits guards first, then armor, then your HP. Power armor guards absorb
              significantly more damage than regulars. Running is risky — failed escapes deal
              partial damage, and brahmin make escape harder.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Weapons</div>
            <p className="text-pip-green-dim leading-relaxed">
              Buy guns and ammo at Armories. You can own multiple weapons — equip whichever you want
              before heading out, and switch at any settlement. Different guns vary in accuracy,
              damage, and special mechanics (burst fire, splash damage, stray shots). Running dry on
              ammo just means your guards carry the fight until you restock.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Services</div>
            <p className="text-pip-green-dim leading-relaxed">
              <span className="text-pip-green">Doctors</span> heal you fully for a fee.{' '}
              <span className="text-pip-green">Loansharks</span> let you borrow caps or repay debt
              — interest compounds every turn, so pay it down fast.{' '}
              <span className="text-pip-green">Armories</span> sell weapons, ammo, armor, and
              taming gear.{' '}
              <span className="text-pip-green">Followers</span> lets you hire guards, power armor
              guards, and brahmin pack animals. Services vary by settlement — check the map icons.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Debt</div>
            <p className="text-pip-green-dim leading-relaxed">
              You start in debt. Interest compounds every turn. After a grace period, the loanshark
              sets payment windows — miss enough of them and enforcers show up on the road. Let it
              spiral long enough and they stop asking. Clearing your debt entirely earns a one-time
              XP bonus.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">XP</div>
            <p className="text-pip-green-dim leading-relaxed">
              XP is earned from: traveling dangerous roads, winning combat, discovering new
              settlements, clearing your debt in full, and selling chems at a profit. In Free Play,
              XP is your entire score. In Standard, XP tracks your accomplishments but doesn't
              affect rank — think of it as a preview of what matters when you move to Free Play.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Mounts (Free Play)</div>
            <p className="text-pip-green-dim leading-relaxed">
              In Free Play you can tame wild creatures. Fight a solo enemy down to low HP, then hit
              TAME. Land 3 hits in the green zone before 3 misses — or it attacks enraged. A tamed
              mount fights beside you each combat turn and absorbs damage after your guards and armor
              are gone. Buy a saddle and taming tool at any Armory first.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Regions</div>
            <p className="text-pip-green-dim leading-relaxed">
              Three regions: <span className="text-pip-green">Commonwealth</span> (easy),{' '}
              <span className="text-pip-amber">Capital Wasteland</span> (medium),{' '}
              <span className="text-pip-red">Mojave Wasteland</span> (hard). Each has its own
              settlements, enemy roster, market dynamics, and debt interest rate. Harder regions
              scale enemy strength and debt pressure significantly.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
