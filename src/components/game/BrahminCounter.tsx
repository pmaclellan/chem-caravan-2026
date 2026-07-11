interface Props { count: number }

// Brahmin can't be targeted and have no HP — one compact counter instead of a card
// per head. Identical in the live Caravan row and the post-combat snapshot, since
// there's no animation state that could ever apply to them.
export default function BrahminCounter({ count }: Props) {
  if (count <= 0) return null
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: '3rem' }} title={`${count} brahmin — each costs 12% escape chance, plus a 30% bolt risk if you flee`}>
      <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
          {/* Body */}
          <path d="M8 14C8 10.5 10.5 9 15 9C19.5 9 22 10.5 22 14C22 17.5 19.5 19 15 19C10.5 19 8 17.5 8 14Z" />
          {/* Upper head — centered on upper half of body */}
          <path d="M2 11C2 8 8 8 8 11C8 14 2 14 2 11Z" />
          {/* Upper horns */}
          <path d="M3.5 9C3 7.5 3.5 6 4.5 6C4.5 7 4 8 3.5 9ZM6.5 8.5C6.5 7 7.5 6 8 6C8 7 7.5 8 6.5 8.5Z" />
          {/* Lower head — centered on lower half of body */}
          <path d="M2 16C2 13.5 8 13.5 8 16C8 18.5 2 18.5 2 16Z" />
          {/* Lower horns */}
          <path d="M3.5 14C3 13 3.5 12 4.5 12C4.5 12.5 4 13.5 3.5 14ZM6.5 13.5C6.5 12.5 7.5 12 8 12C8 12.5 7.5 13 6.5 13.5Z" />
          {/* Legs */}
          <rect x="9.5" y="18" width="2" height="5.5" rx="1" />
          <rect x="12.5" y="18" width="2" height="5.5" rx="1" />
          <rect x="16" y="18.5" width="2" height="5" rx="1" />
          <rect x="19" y="18.5" width="1.5" height="4.5" rx="0.75" />
          {/* Tail */}
          <path d="M22 13C23.5 11 23 9 21.5 8.5C22.5 10 22.5 12 22 13Z" />
        </svg>
      </div>
      <div className="text-center font-display" style={{ fontSize: '0.7rem', color: 'var(--pip-amber)' }}>×{count}</div>
      <div className="text-center" style={{ fontSize: '0.55rem', color: 'var(--pip-amber)', opacity: 0.7 }}>BRAHMIN</div>
    </div>
  )
}
