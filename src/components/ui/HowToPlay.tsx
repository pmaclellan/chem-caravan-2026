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
              Survive the wasteland for 30 turns. Buy and sell chems to pay off your debt and get rich.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Trading</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each settlement has different prices. Buy low, sell high. Market events (shortages and
              surpluses) create big profit windows — watch the log for tips.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Travel</div>
            <p className="text-pip-green-dim leading-relaxed">
              Moving between settlements costs caps and advances the turn counter. Each road has a
              danger rating: higher danger = more events and tougher enemies. Guards improve your
              survival odds; brahmin add carry capacity but slow your escape chance.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Combat</div>
            <p className="text-pip-green-dim leading-relaxed">
              You can FIGHT or RUN when ambushed. Your guards fire alongside you each turn, drawing
              from the same ammo pool. Fighting lets you loot caps and chems from defeated enemies.
              Running is risky with brahmin. Losing all health ends the game.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Services</div>
            <p className="text-pip-green-dim leading-relaxed">
              Doctors heal you. Banks let you deposit / withdraw (no interest). Loansharks extend
              your debt — think carefully. Gun shops sell weapons and ammo for you and your guards.
              Guards and brahmin are hired here.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Price Colors</div>
            <p className="text-pip-green-dim leading-relaxed">
              Prices are color-coded by where they fall in the full historical range for that chem:
              blue = unusually cheap, dim = near base, rust = unusually expensive. Buy blue, sell rust.
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
