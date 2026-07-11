import { useEffect } from 'react'

// Global left/right arrow-key stepping — mirrors the addEventListener/cleanup convention in
// @main/hooks/useIsMobile.ts. Only one stepper (turn view or combat replay view) should be
// enabled at a time.
export function useArrowKeyStep(onPrev: () => void, onNext: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onPrev, onNext, enabled])
}
