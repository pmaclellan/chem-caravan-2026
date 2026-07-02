import { CHANGELOG } from '../../data/changelog'

interface Props {
  onClose: () => void
}

export function Changelog({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="pip-panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="font-display text-3xl text-pip-green tracking-widest">WHAT'S NEW</h2>
          <button className="pip-btn text-sm px-3 py-1" onClick={onClose}>CLOSE</button>
        </div>

        <div className="space-y-5 text-sm font-mono">
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version} className={i > 0 ? 'border-t border-pip-border-dim pt-4' : ''}>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-display text-pip-green text-lg tracking-wider">v{entry.version}</span>
                <span className="text-pip-green-dim text-xs">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-pip-green-dim leading-relaxed">
                    <span className="text-pip-green flex-shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
