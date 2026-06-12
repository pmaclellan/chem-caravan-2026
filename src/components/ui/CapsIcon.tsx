interface Props {
  size?: number
  className?: string
}

export function CapsIcon({ size = 14, className = '' }: Props) {
  return (
    <img
      src="/assets/icons/coin-alt-svgrepo-com.svg"
      alt="caps"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      style={{ opacity: 0.82 }}
    />
  )
}
