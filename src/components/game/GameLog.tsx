import type { LogEntry } from '../../types/game'

interface Props { log: LogEntry[] }

export default function GameLog({ log }: Props) {
  // Newest first — no auto-scroll needed
  const displayed = [...log].reverse().slice(0, 50)

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
      </div>
    </div>
  )
}
