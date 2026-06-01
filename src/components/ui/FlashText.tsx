/**
 * Wraps children in a span that plays a text-glow animation whenever flashKey increments.
 * Mounting a new span (via key) restarts the animation from scratch each time.
 */

export type FlashTextVariant = 'amber' | 'green' | 'red'

interface Props {
  flashKey: number
  variant: FlashTextVariant
  children: React.ReactNode
  className?: string
}

export function FlashText({ flashKey, variant, children, className = '' }: Props) {
  return (
    <span
      key={flashKey}
      className={`${flashKey > 0 ? `pip-flash-text-${variant}` : ''} ${className}`.trim()}
    >
      {children}
    </span>
  )
}
