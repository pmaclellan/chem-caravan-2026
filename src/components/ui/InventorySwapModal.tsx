import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'

interface Props {
  player: PlayerState
  /** Items being offered — chemId → quantity */
  incomingItems: Record<string, number>
  /** Called when player confirms; receives the items they chose to drop */
  onConfirm: (dropped: Record<string, number>) => void
  /** If omitted, no "leave it" button is shown (e.g. mandatory loot screen) */
  onSkip?: () => void
  title?: string
}

export default function InventorySwapModal({
  player,
  incomingItems,
  onConfirm,
  onSkip,
  title = 'INVENTORY FULL',
}: Props) {
  const [pendingDrops, setPendingDrops] = useState<Record<string, number>>({})

  const capacity     = calculateCapacity(player.brahmin)
  const currentTotal = totalInventoryItems(player.inventory)
  const incomingTotal = Object.values(incomingItems).reduce((s, n) => s + n, 0)
  const droppedTotal  = Object.values(pendingDrops).reduce((s, n) => s + n, 0)
  const projectedUsed = currentTotal - droppedTotal + incomingTotal
  const slotsNeeded   = Math.max(0, projectedUsed - capacity)
  const hasRoom       = slotsNeeded === 0
  const capacityPct   = Math.min(100, Math.round((projectedUsed / capacity) * 100))

  function drop(chemId: string) {
    const owned   = player.inventory[chemId]?.quantity ?? 0
    const current = pendingDrops[chemId] ?? 0
    if (current >= owned) return
    setPendingDrops(p => ({ ...p, [chemId]: current + 1 }))
  }

  function undrop(chemId: string) {
    const current = pendingDrops[chemId] ?? 0
    if (current <= 0) return
    setPendingDrops(p => {
      const next = current - 1
      if (next === 0) {
        const { [chemId]: _, ...rest } = p
        return rest
      }
      return { ...p, [chemId]: next }
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="border border-pip-border rounded p-4 flex flex-col gap-4"
        style={{
          background: 'var(--pip-bg)',
          boxShadow: '0 0 0 1px var(--pip-border-dim), 0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: '28rem',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="text-pip-red font-display text-2xl border-b border-pip-border pb-2">
          !! {title} !!
        </div>

        {/* Capacity bar */}
        <div>
          <div className="pip-label mb-1 flex justify-between">
            <span>PACK CAPACITY</span>
            <span style={{ color: hasRoom ? 'var(--pip-green)' : 'var(--pip-red)' }}>
              {projectedUsed} / {capacity}
            </span>
          </div>
          <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--pip-border-dim)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${capacityPct}%`,
                background: hasRoom ? 'var(--pip-green)' : 'var(--pip-red)',
              }}
            />
          </div>
          {!hasRoom && (
            <div className="text-xs mt-1" style={{ color: 'var(--pip-red)' }}>
              Drop {slotsNeeded} more {slotsNeeded === 1 ? 'item' : 'items'} to make room.
            </div>
          )}
        </div>

        {/* Incoming items */}
        <div className="border border-pip-border rounded p-3" style={{ borderColor: 'var(--pip-amber)' }}>
          <div className="pip-label mb-2" style={{ color: 'var(--pip-amber)' }}>INCOMING LOOT</div>
          <div className="flex flex-col gap-0.5">
            {Object.entries(incomingItems).map(([chemId, qty]) => (
              <div key={chemId} className="flex justify-between text-sm">
                <span className="font-display" style={{ color: 'var(--pip-amber)' }}>
                  {CHEMS[chemId]?.name ?? chemId}
                </span>
                <span style={{ color: 'var(--pip-amber)' }}>×{qty}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current pack — interactive */}
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">YOUR PACK — DROP TO MAKE ROOM</div>
          <div className="flex flex-col gap-1">
            {Object.entries(player.inventory).map(([chemId, entry]) => {
              const dropped   = pendingDrops[chemId] ?? 0
              const effective = entry.quantity - dropped
              const chem      = CHEMS[chemId]
              return (
                <div key={chemId} className="flex items-center gap-2 text-sm py-0.5 border-b border-pip-border-dim last:border-0">
                  <span
                    className="flex-1 font-display"
                    style={{
                      color: effective === 0 ? 'var(--pip-border)' : 'var(--pip-green)',
                      textDecoration: effective === 0 ? 'line-through' : 'none',
                    }}
                  >
                    {chem?.name ?? chemId}
                  </span>
                  <span
                    className="text-xs w-8 text-right"
                    style={{ color: effective === 0 ? 'var(--pip-red)' : 'var(--pip-green-dim)' }}
                  >
                    ×{effective}
                  </span>
                  <button
                    className="pip-btn-danger text-xs px-1.5 py-0 leading-5"
                    disabled={effective === 0}
                    onClick={() => drop(chemId)}
                  >
                    −
                  </button>
                  <button
                    className="pip-btn text-xs px-1.5 py-0 leading-5"
                    disabled={dropped === 0}
                    onClick={() => undrop(chemId)}
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
          {droppedTotal > 0 && (
            <div className="text-xs mt-2 italic" style={{ color: 'var(--pip-red)' }}>
              Dropping {droppedTotal} {droppedTotal === 1 ? 'item' : 'items'}.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="pip-btn flex-1"
            disabled={!hasRoom}
            onClick={() => onConfirm(pendingDrops)}
          >
            {hasRoom ? 'TAKE LOOT' : `NEED ${slotsNeeded} MORE SLOT${slotsNeeded !== 1 ? 'S' : ''}`}
          </button>
          {onSkip && (
            <button className="pip-btn-amber" onClick={onSkip}>
              LEAVE IT
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
