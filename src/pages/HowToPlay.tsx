import { useNavigate } from 'react-router-dom'

export default function HowToPlayPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-4xl text-pip-green tracking-widest">HOW TO PLAY</h1>
          <button className="pip-btn" onClick={() => navigate('/')}>BACK</button>
        </div>

        <div className="pip-panel space-y-5 text-sm font-mono">
          <section>
            <div className="pip-label mb-1">Objective</div>
            <p className="text-pip-green-dim leading-relaxed">
              Survive the wasteland for 30 turns. Buy and sell chems to pay off your debt and get rich.
              Final score = caps on hand + bank balance − debt remaining.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Trading</div>
            <p className="text-pip-green-dim leading-relaxed">
              Each settlement has different prices. Buy low, sell high. Market events (shortages and
              surpluses) create big profit windows — watch the log for tips. Shortage = high prices
              (sell there). Surplus = low prices (buy there).
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Travel</div>
            <p className="text-pip-green-dim leading-relaxed">
              Moving between settlements costs caps and advances the turn counter. Each road has a
              danger rating — higher danger means more random events and tougher enemies. Guards
              improve your combat survival and escape odds. Brahmin add pack capacity but make fleeing
              harder.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Combat</div>
            <p className="text-pip-green-dim leading-relaxed">
              When ambushed, you can FIGHT or RUN. Your guards fire alongside you each turn from
              the same ammo pool — one round per guard per turn. Fighting lets you loot caps and
              chems from defeated enemies. Running becomes harder with brahmin in tow. Losing all
              health ends your run.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Services</div>
            <p className="text-pip-green-dim leading-relaxed">
              <span className="text-pip-green">Doctors</span> heal you fully for a fee.{' '}
              <span className="text-pip-green">Banks</span> hold your caps safe from robbery — no
              interest charged.{' '}
              <span className="text-pip-green">Loansharks</span> extend your debt at compound
              interest — think carefully before borrowing.{' '}
              <span className="text-pip-green">Gun shops</span> sell weapons and ammo.{' '}
              <span className="text-pip-green">Guard posts</span> and{' '}
              <span className="text-pip-green">Brahmin yards</span> let you hire protection and
              pack animals.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Debt</div>
            <p className="text-pip-green-dim leading-relaxed">
              You start with a debt that compounds each turn. Leave it too long and enforcers start
              showing up on the road. Let it run long enough and they stop making house calls —
              they collect permanently.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Price Colors</div>
            <p className="text-pip-green-dim leading-relaxed">
              Chem prices are color-coded across their full historical range. Blue = unusually
              cheap (buy). Dim/neutral = base price. Rust = unusually expensive (sell). No judgment
              calls — just position in the range.
            </p>
          </section>

          <section>
            <div className="pip-label mb-1">Regions</div>
            <p className="text-pip-green-dim leading-relaxed">
              Three regions are available, each with its own settlements, enemy roster, and market.
              Difficulty scales through enemy health, damage, and debt interest rate.
              Pick the one that suits your risk appetite.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
