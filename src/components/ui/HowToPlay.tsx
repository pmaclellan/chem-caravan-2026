const TUTORIAL_KEY = 'chem_caravan_tutorial_seen'

export function markTutorialSeen() {
  localStorage.setItem(TUTORIAL_KEY, '1')
}

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(TUTORIAL_KEY)
}

interface Props {
  onClose: () => void
}

export function HowToPlay({ onClose }: Props) {
  function handleClose() {
    markTutorialSeen()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="pip-panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="font-display text-3xl text-pip-green tracking-widest">HOW TO PLAY</h2>
          <button className="pip-btn text-sm px-3 py-1" onClick={handleClose}>CLOSE</button>
        </div>

        <div className="space-y-3 text-sm font-mono text-pip-green">
          <section>
            <div className="pip-label mb-1">Objective</div>
            <p className="text-pip-green-dim leading-relaxed">
              Buy and sell chems across the wasteland, pay off your debt, and get rich.{' '}
              <span className="text-pip-green">Standard</span> mode is an economic optimization
              puzzle with a deadline — 30 turns to build the highest score you can.{' '}
              <span className="text-pip-green">Free Play</span> has no turn limit and scores by XP.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Scoring</div>
            <p className="text-pip-green-dim leading-relaxed">
              <span className="text-pip-green">Standard:</span> score = net worth (caps +
              inventory + weapons + armor − debt). Buy good gear and hold it — power armor
              and heavy weapons count as assets, not liabilities.
            </p>
            <p className="text-pip-green-dim leading-relaxed mt-1">
              <span className="text-pip-green">Free Play:</span> score = XP only. Earned from
              combat, travel, discovery, profitable trades, and clearing debt.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Trading</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each settlement has different prices. Buy low, sell high. Market events (shortages
              and surpluses) create big profit windows — watch the log. Prices are color-coded:{' '}
              <span className="text-pip-blue">blue</span> = cheap (buy),{' '}
              <span className="text-pip-amber">rust</span> = expensive (sell).
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Travel</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each trip advances the turn. Guard salary is deducted every turn — keep enough caps
              to cover it. Higher danger roads mean more combat and tougher enemies. Guards help
              you fight and flee. Brahmin add carry capacity but slow your escape.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Combat</div>
            <p className="text-pip-green-dim leading-relaxed">
              Choose FIGHT or RUN. Your gun fires first, then each guard fires their own sidearm
              — guards carry their own ammo. No gun? Guards still fight for you. Guards absorb
              hits before your HP does. Armor absorbs after guards. Winning loots caps and chems.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Weapons</div>
            <p className="text-pip-green-dim leading-relaxed">
              Buy guns at Armories. Own multiple — equip whichever you want before heading out
              and switch at any settlement. Running dry on ammo just means your guards carry
              the fight until you restock.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Services</div>
            <p className="text-pip-green-dim leading-relaxed">
              <span className="text-pip-green">Doctors</span> heal HP.{' '}
              <span className="text-pip-green">Loansharks</span> handle debt (interest compounds
              every turn — pay it down fast).{' '}
              <span className="text-pip-green">Armories</span> sell weapons, ammo, and armor.{' '}
              <span className="text-pip-green">Followers</span> hire guards and brahmin.
              Services vary by settlement — check the map icons.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Debt</div>
            <p className="text-pip-green-dim leading-relaxed">
              Debt compounds every turn. After a grace period, payment windows open — miss too
              many and enforcers start appearing on the road. Clearing debt entirely earns a
              one-time XP bonus.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Price Colors</div>
            <p className="text-pip-green-dim leading-relaxed">
              Prices are color-coded across their full historical range:{' '}
              <span className="text-pip-blue">blue</span> = unusually cheap,
              dim = near base price,{' '}
              <span className="text-pip-amber">rust</span> = unusually expensive.
              Buy blue, sell rust.
            </p>
          </section>
        </div>

        <button className="pip-btn w-full text-lg" onClick={handleClose}>
          ENTER THE WASTELAND
        </button>
      </div>
    </div>
  )
}
