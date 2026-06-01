import { useEffect, useRef, useState } from 'react'

export interface MapFlashEntry {
  key: number
  direction: 'up' | 'down'
}

/**
 * Tracks a Record<string, number> and fires a flash for each key that changes.
 * Runs after every render but only triggers re-renders when values actually differ.
 */
export function useMapFlash(values: Record<string, number>): Record<string, MapFlashEntry> {
  const [flashes, setFlashes] = useState<Record<string, MapFlashEntry>>({})
  const prevRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const prev = prevRef.current
    const changes: Record<string, 'up' | 'down'> = {}

    for (const key of new Set([...Object.keys(prev), ...Object.keys(values)])) {
      const p = prev[key] ?? 0
      const c = values[key] ?? 0
      if (c !== p) changes[key] = c > p ? 'up' : 'down'
    }

    prevRef.current = values

    if (Object.keys(changes).length > 0) {
      setFlashes(f => {
        const next = { ...f }
        for (const [key, dir] of Object.entries(changes)) {
          next[key] = { key: (f[key]?.key ?? 0) + 1, direction: dir }
        }
        return next
      })
    }
  })

  return flashes
}
