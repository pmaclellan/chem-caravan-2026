import { useEffect, useState } from 'react'
import { gameBus } from '../../engine/eventBus'
import { ACHIEVEMENT_MAP } from '../../data/achievements'

interface ToastItem {
  key: number
  achievementId: string
  xpAwarded: number
}

interface Props {
  onOpenDossier: () => void
}

let _key = 0

export default function AchievementToast({ onOpenDossier }: Props) {
  const [queue, setQueue] = useState<ToastItem[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = ({ achievementId, xpAwarded }: { achievementId: string; xpAwarded: number }) => {
      setQueue(q => [...q, { key: ++_key, achievementId, xpAwarded }])
    }
    gameBus.on('ACHIEVEMENT_UNLOCKED', handler)
    return () => gameBus.off('ACHIEVEMENT_UNLOCKED', handler)
  }, [])

  // Animate in when a new item arrives
  useEffect(() => {
    if (queue.length > 0) {
      setVisible(false)
      const show = setTimeout(() => setVisible(true), 30)
      return () => clearTimeout(show)
    } else {
      setVisible(false)
    }
  }, [queue[0]?.key])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss after 4s
  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => setQueue(q => q.slice(1)), 4000)
    return () => clearTimeout(t)
  }, [queue[0]?.key])  // eslint-disable-line react-hooks/exhaustive-deps

  if (queue.length === 0) return null

  const current = queue[0]
  const def = ACHIEVEMENT_MAP[current.achievementId]
  if (!def) return null

  function handleClick() {
    setQueue([])
    onOpenDossier()
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[60] max-w-xs w-full -translate-x-1/2 transition-all duration-300 cursor-pointer"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
      }}
      onClick={handleClick}
    >
      <div
        className="pip-panel border border-pip-blue px-4 py-3 flex items-start gap-3"
        style={{
          boxShadow: '0 0 16px color-mix(in srgb, var(--pip-blue) 70%, transparent), 0 0 40px color-mix(in srgb, var(--pip-blue) 30%, transparent)',
        }}
      >
        <img
          src={`/assets/icons/${def.icon}`}
          alt=""
          className="w-8 h-8 flex-shrink-0 mt-0.5"
          style={{ opacity: 0.85 }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-pip-blue text-xs tracking-widest mb-0.5">
            ACHIEVEMENT UNLOCKED
          </div>
          <div className="font-display text-pip-green text-base leading-tight">{def.name}</div>
          <div className="text-pip-green-dim text-xs mt-0.5">+{current.xpAwarded} XP · tap to view all</div>
        </div>
        <button
          className="flex-shrink-0 text-pip-green-dim hover:text-pip-green text-xs mt-0.5"
          onClick={e => { e.stopPropagation(); setQueue(q => q.slice(1)) }}
        >
          ✕
        </button>
      </div>
      {queue.length > 1 && (
        <div className="text-center text-pip-green-dim text-xs mt-1 font-mono">
          +{queue.length - 1} more
        </div>
      )}
    </div>
  )
}
