// Maps a chem's current price to a visual color based on its position within
// the expected price range [basePrice*(1-variance), basePrice*(1+variance)].
//
// Scale (t = 0 → cheapest, 0.5 → base price, 1 → most expensive):
//   very cheap  (t < 0.15): cool slate blue — fenced / fire-sale
//   cheap       (t < 0.38): muted teal
//   base        (t < 0.62): earthy dim — neutral, no signal
//   expensive   (t < 0.85): warm amber
//   very expensive (t ≥ 0.85): deep rust — highway robbery
//
// Prices outside the normal range (e.g. merchant fencing stolen goods)
// are clamped, so extreme values just deepen toward the endpoint color.

export interface PriceStyle {
  color: string
  textShadow?: string
}

export function priceColor(price: number, basePrice: number, priceVariance: number): PriceStyle {
  const minP  = basePrice * (1 - priceVariance)
  const maxP  = basePrice * (1 + priceVariance)
  const range = maxP - minP
  if (range === 0) return { color: '#8a7040' }

  const t = (price - minP) / range   // can go below 0 or above 1 for out-of-range prices

  if (t < 0.15) return { color: '#4a8fc0', textShadow: '0 0 7px rgba(74,143,192,0.50)' }
  if (t < 0.38) return { color: '#4ea080' }
  if (t < 0.62) return { color: '#8a7040' }
  if (t < 0.85) return { color: '#c47810', textShadow: '0 1px 2px rgba(20,8,0,0.55)' }
  return       { color: '#cc4c18', textShadow: '0 1px 2px rgba(20,8,0,0.55), 0 0 8px rgba(204,76,24,0.40)' }
}
