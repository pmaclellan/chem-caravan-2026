// All random calls go through this wrapper so we can swap to a seeded PRNG later
export function rng(): number {
  return Math.random()
}

export function rngBetween(min: number, max: number): number {
  return min + rng() * (max - min)
}

export function rngInt(min: number, max: number): number {
  return Math.floor(rngBetween(min, max + 1))
}

export function rngPick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function rngWeightedPick<T extends { weight: number }>(items: T[]): T | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  if (total === 0) return null
  let cursor = rng() * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]
}
