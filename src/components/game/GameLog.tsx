import { useEffect, useRef } from 'react'
import type { LogEntry } from '../../types/game'

interface Props { log: LogEntry[] }

export default function GameLog({ log }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const displayed = log.slice(-50)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="pip-panel flex flex-col h-full">
      <div className="pip-section-title text-lg">LOG</div>
      <div className="flex-1 overflow-y-auto text-xs font-mono space-y-1 min-h-0">
        {displayed.map((entry, i) => (
          <div key={i} className={`log-${entry.type}`}>
            <span className="text-pip-green-dim">[T{String(entry.turn).padStart(2, '0')}]</span>{' '}
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
