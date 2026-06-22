import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'

interface Props {
  player: PlayerState
  /** Items being offered — chemId → max quantity available */
  incomingItems: Record<string, number>
  /**
   * Called when player confirms. Receives:
   * - dropped: items removed from pack (chemId → qty dropped)
   * - taken:   items actually accepted from loot (chemId → qty taken, ≤ incomingItems[chemId])
   */
  onConfirm: (dropped: Record<string, number>, taken: Record<string, number>) => void
  /** If omitted, no "leave all" button is shown */
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
  const [lootSkipped, setLootSkipped]  = useState<Record<string, number>>({})

  const capacity     = calculateCapacity(player.brahmin)
  const currentTotal = totalInventoryItems(player.inventory)

  const droppedTotal  = Object.values(pendingDrops).reduce((s, n) => s + n, 0)
  const takingTotal   = Object.entries(incomingItems).reduce(
    (s, [id, qty]) => s + qty - (lootSkipped[id] ?? 0), 0
  )
  const projectedUsed = currentTotal - droppedTotal + takingTotal
  const slotsNeeded   = Math.max(0, projectedUsed - capacity)
  const hasRoom       = slotsNeeded === 0
  const capacityPct   = Math.min(100, Math.round((projectedUsed / capacity) * 100))

  function drop(chemId: string) {
    const owned = player.inventory[chemId]?.quantity ?? 0
    const cur   = pendingDrops[chemId] ?? 0
    if (cur >= owned) return
    setPendingDrops(p => ({ ...p, [chemId]: cur + 1 }))
  }
  function undrop(chemId: string) {
    const cur = pendingDrops[chemId] ?? 0
    if (cur <= 0) return
    setPendingDrops(p => {
      const next = cur - 1
      if (next === 0) { const { [chemId]: _, ...rest } = p; return rest }
      return { ...p, [chemId]: next }
    })
  }

  function skipLoot(chemId: string) {
    const max = incomingItems[chemId] ?? 0
    const cur = lootSkipped[chemId] ?? 0
    if (cur >= max) return
    setLootSkipped(p => ({ ...p, [chemId]: cur + 1 }))
  }
  function unskipLoot(chemId: string) {
    const cur = lootSkipped[chemId] ?? 0
    if (cur <= 0) return
    setLootSkipped(p => {
      const next = cur - 1
      if (next === 0) { const { [chemId]: _, ...rest } = p; return rest }
      return { ...p, [chemId]: next }
    })
  }

  function handleConfirm() {
    const taken = Object.fromEntries(
      Object.entries(incomingItems)
        .map(([id, qty]) => [id, qty - (lootSkipped[id] ?? 0)])
        .filter(([, qty]) => (qty as number) > 0)
    ) as Record<string, number>
    onConfirm(pendingDrops, taken)
  }

  const skippedParts = Object.entries(lootSkipped)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${n}× ${CHEMS[id]?.name ?? id}`)

  const droppedParts = Object.entries(pendingDrops)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${n}× ${CHEMS[id]?.name ?? id}`)

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
          <div className="text-xs mt-1" style={{ color: hasRoom ? 'var(--pip-green-dim)' : 'var(--pip-red)', minHeight: '1rem' }}>
            {!hasRoom
              ? `Drop ${slotsNeeded} more ${slotsNeeded === 1 ? 'item' : 'items'}, or take fewer from loot.`
              : takingTotal > 0 ? 'Pack has room. Ready to take loot.' : ''}
          </div>
        </div>

        {/* Incoming loot — interactive */}
        <div className="border rounded p-3" style={{ borderColor: 'var(--pip-amber)', background: 'rgba(196,80,26,0.04)' }}>
          <div className="pip-label mb-2" style={{ color: 'var(--pip-amber)' }}>LOOT FOUND — TAKE WHAT YOU CAN CARRY</div>
          <div className="flex flex-col">
            {Object.entries(incomingItems).map(([chemId, maxQty]) => {
              const skipped  = lootSkipped[chemId] ?? 0
              const taking   = maxQty - skipped
              const chem     = CHEMS[chemId]
              return (
                <div key={chemId} className="flex items-center gap-2 text-sm py-1 border-b border-pip-border-dim last:border-0">
                  <span
                    className="flex-1 font-display"
                    style={{
                      color: taking === 0 ? 'var(--pip-border)' : 'var(--pip-amber)',
                      textDecoration: taking === 0 ? 'line-through' : 'none',
                    }}
                  >
                    {chem?.name ?? chemId}
                  </span>
                  <span className="text-xs w-8 text-right" style={{ color: taking === 0 ? 'var(--pip-border)' : 'var(--pip-amber)' }}>
                    ×{taking}
                  </span>
                  <button
                    className="pip-btn-danger text-xs px-1.5 py-0 leading-5"
                    style={{ borderColor: 'var(--pip-amber)', color: 'var(--pip-amber)' }}
                    disabled={taking === 0}
                    onClick={() => skipLoot(chemId)}
                  >
                    −
                  </button>
                  <button
                    className="pip-btn text-xs px-1.5 py-0 leading-5"
                    disabled={skipped === 0}
                    onClick={() => unskipLoot(chemId)}
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
          {skippedParts.length > 0 && (
            <div className="text-xs mt-2 italic" style={{ color: 'var(--pip-green-dim)' }}>
              Leaving behind: {skippedParts.join(', ')}.
            </div>
          )}
        </div>

        {/* Pack contents — interactive */}
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">YOUR PACK — DROP TO MAKE ROOM</div>
          <div className="flex flex-col">
            {Object.entries(player.inventory).map(([chemId, entry]) => {
              const dropped   = pendingDrops[chemId] ?? 0
              const effective = entry.quantity - dropped
              const chem      = CHEMS[chemId]
              return (
                <div key={chemId} className="flex items-center gap-2 text-sm py-1 border-b border-pip-border-dim last:border-0">
                  <span
                    className="flex-1 font-display"
                    style={{
                      color: effective === 0 ? 'var(--pip-border)' : 'var(--pip-green)',
                      textDecoration: effective === 0 ? 'line-through' : 'none',
                    }}
                  >
                    {chem?.name ?? chemId}
                  </span>
                  <span className="text-xs w-8 text-right" style={{ color: effective === 0 ? 'var(--pip-red)' : 'var(--pip-green-dim)' }}>
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
          {droppedParts.length > 0 && (
            <div className="text-xs mt-2 italic" style={{ color: 'var(--pip-red)' }}>
              Dropping: {droppedParts.join(', ')}.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="pip-btn flex-1"
            disabled={!hasRoom || takingTotal === 0}
            onClick={handleConfirm}
          >
            {!hasRoom
              ? `NEED ${slotsNeeded} MORE SLOT${slotsNeeded !== 1 ? 'S' : ''}`
              : takingTotal === 0
                ? 'NOTHING SELECTED'
                : `TAKE ${takingTotal} ITEM${takingTotal !== 1 ? 'S' : ''}`}
          </button>
          {onSkip && (
            <button className="pip-btn-amber" onClick={onSkip}>
              LEAVE ALL
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
