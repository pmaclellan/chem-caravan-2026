// Maps a chem's current price to a visual color based on its position within
// the expected price range [basePrice*(1-variance), basePrice*(1+variance)].
// The t → color bucketing itself lives in intensityColor.ts (shared with other
// magnitude encodings); this file just computes t from a price range.
//
// Prices outside the normal range (e.g. merchant fencing stolen goods)
// are clamped, so extreme values just deepen toward the endpoint color.

import { intensityColor, type IntensityStyle } from './intensityColor'

export type PriceStyle = IntensityStyle

export function priceColor(price: number, basePrice: number, priceVariance: number): PriceStyle {
  const minP  = basePrice * (1 - priceVariance)
  const maxP  = basePrice * (1 + priceVariance)
  const range = maxP - minP
  if (range === 0) return { color: '#8a7040' }

  const t = (price - minP) / range   // can go below 0 or above 1 for out-of-range prices
  return intensityColor(t)
}
