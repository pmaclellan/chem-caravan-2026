import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { GAME_MODES } from '../../data/modes'
import { useGameStore } from '../../store/gameStore'
import { DoctorPanel } from './service-panels/DoctorPanel'
import { LoansharkPanel } from './service-panels/LoansharkPanel'
import { ArmoryPanel } from './service-panels/ArmoryPanel'
import { FollowersPanel } from './service-panels/FollowersPanel'

interface Props { player: PlayerState }

type Tab = 'doctor' | 'loanshark' | 'armory' | 'followers'

export default function ServicesPanel({ player }: Props) {
  const mode       = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc         = GAME_MODES[mode]
  const settlement = mc.settlements[player.location]
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const store      = useGameStore()

  const tabs: { key: Tab; icon: string; label: string; available: boolean }[] = (
    [
      { key: 'doctor',    icon: '/assets/icons/bandage-svgrepo-com.svg',          label: 'DOCTOR',    available: settlement.hasDoctor },
      { key: 'loanshark', icon: '/assets/icons/briefcase-dollar-svgrepo-com.svg', label: 'LOANS',     available: settlement.hasLoanshark },
      { key: 'armory',    icon: '/assets/icons/crosshair-svgrepo-com.svg',        label: 'ARMORY',    available: settlement.hasArmory },
      { key: 'followers', icon: '/assets/icons/followers-svgrepo-com.svg',        label: 'FOLLOWERS', available: settlement.hasFollowers },
    ] as { key: Tab; icon: string; label: string; available: boolean }[]
  ).filter(t => t.available)

  if (tabs.length === 0) {
    return <div className="text-pip-green-dim text-sm">No services available here.</div>
  }

  const isVenomed      = player.conditions?.some(c => c.type === 'radscorpion_venom') ?? false
  const antivenomOwned = player.inventory['antivenom']?.quantity ?? 0

  return (
    <div className="flex flex-col gap-3">
      {isVenomed && (
        <div className="border border-red-500 p-2 rounded text-xs space-y-1">
          <div className="text-red-400 font-bold">⚠ SCORPION VENOM — -5 HP per travel turn</div>
          {antivenomOwned > 0 ? (
            <button className="pip-btn w-full" onClick={() => store.useAntivenom()}>
              USE ANTIVENOM (have {antivenomOwned})
            </button>
          ) : (
            <div className="text-pip-green-dim">Buy antivenom at a doctor to cure this.</div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'pip-btn bg-pip-green text-pip-bg flex items-center gap-1.5' : 'pip-btn flex items-center gap-1.5'}
            onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
          >
            <img src={tab.icon} alt="" style={{ height: '1.25em', width: '1.25em', display: 'block', opacity: 0.75 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'doctor'    && <DoctorPanel    player={player} />}
      {activeTab === 'loanshark' && <LoansharkPanel player={player} />}
      {activeTab === 'armory'    && <ArmoryPanel    player={player} />}
      {activeTab === 'followers' && <FollowersPanel player={player} />}
    </div>
  )
}
