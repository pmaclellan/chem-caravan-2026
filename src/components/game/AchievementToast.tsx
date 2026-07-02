import { useEffect, useRef, useState } from 'react'
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
const HOLD_MS = 3800

export default function AchievementToast({ onOpenDossier }: Props) {
  const [queue, setQueue] = useState<ToastItem[]>([])
  // 'in' | 'out' | 'hidden'
  const [phase, setPhase] = useState<'in' | 'out' | 'hidden'>('hidden')
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const handler = ({ achievementId, xpAwarded }: { achievementId: string; xpAwarded: number }) => {
      setQueue(q => [...q, { key: ++_key, achievementId, xpAwarded }])
    }
    gameBus.on('ACHIEVEMENT_UNLOCKED', handler)
    return () => gameBus.off('ACHIEVEMENT_UNLOCKED', handler)
  }, [])

  // Animate progress bar
  function startProgress() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = performance.now()
    const tick = () => {
      const elapsed = performance.now() - startRef.current
      setProgress(Math.min(elapsed / HOLD_MS, 1))
      if (elapsed < HOLD_MS) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // When the front of the queue changes, run slide-in
  useEffect(() => {
    if (queue.length === 0) {
      setPhase('hidden')
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    setPhase('out')
    setProgress(0)
    const slideIn = setTimeout(() => {
      setPhase('in')
      startProgress()
    }, 160)
    return () => clearTimeout(slideIn)
  }, [queue[0]?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance after hold period
  useEffect(() => {
    if (queue.length === 0) return
    const t = setTimeout(() => setQueue(q => q.slice(1)), HOLD_MS + 160)
    progressRef.current = t
    return () => clearTimeout(t)
  }, [queue[0]?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  if (queue.length === 0) return null

  const current = queue[0]
  const def = ACHIEVEMENT_MAP[current.achievementId]
  if (!def) return null

  const total = queue.length
  const index = 1 // current is always the front

  function handleClick() {
    setQueue([])
    onOpenDossier()
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation()
    if (progressRef.current) clearTimeout(progressRef.current)
    setQueue(q => q.slice(1))
  }

  const isIn = phase === 'in'

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[60] max-w-xs w-full cursor-pointer"
      style={{
        transform: `translateX(-50%) translateY(${isIn ? 0 : 12}px)`,
        opacity: isIn ? 1 : 0,
        transition: 'opacity 150ms ease, transform 150ms ease',
      }}
      onClick={handleClick}
    >
      <div
        className="pip-panel border border-pip-blue px-4 py-3 flex items-start gap-3"
        style={{
          boxShadow: '0 0 16px color-mix(in srgb, var(--pip-blue) 70%, transparent), 0 0 40px color-mix(in srgb, var(--pip-blue) 30%, transparent)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <img
          src={`/assets/icons/${def.icon}`}
          alt=""
          className="w-8 h-8 flex-shrink-0 mt-0.5"
          style={{ opacity: 0.85 }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-pip-blue text-xs tracking-widest mb-0.5 flex items-center justify-between">
            <span>ACHIEVEMENT UNLOCKED</span>
            {total > 1 && (
              <span className="text-pip-green-dim font-mono text-xs ml-2 tabular-nums">
                {index}&nbsp;/&nbsp;{total}
              </span>
            )}
          </div>
          <div className="font-display text-pip-green text-base leading-tight">{def.name}</div>
          <div className="text-pip-green-dim text-xs mt-0.5">+{current.xpAwarded} XP · tap to view all</div>
        </div>
        <button
          className="flex-shrink-0 text-pip-green-dim hover:text-pip-green text-xs mt-0.5"
          onClick={handleDismiss}
        >
          ✕
        </button>

        {/* Progress bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 2,
            width: `${progress * 100}%`,
            background: 'var(--pip-blue)',
            opacity: 0.6,
            transition: 'none',
          }}
        />
      </div>
    </div>
  )
}
