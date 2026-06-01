import { useEffect, useRef, useState } from 'react'

export interface ValueFlash {
  flashKey: number
  direction: 'up' | 'down' | null
}

/** Tracks a single numeric value and fires a flash whenever it changes. */
export function useValueFlash(value: number): ValueFlash {
  const [flashKey, setFlashKey] = useState(0)
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      setDirection(value > prevRef.current ? 'up' : 'down')
      setFlashKey(k => k + 1)
    }
    prevRef.current = value
  }, [value])

  return { flashKey, direction }
}
