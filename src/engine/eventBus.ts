export type GameEventMap = {
  COMBAT_RESOLVED: {
    outcome: 'won' | 'fled' | 'lost'
    killedEnemies: Array<{ typeId: string }>
    weaponId: string | null
    damageDealt: number
    damageTaken: number
    capsLooted: number
  }
  CHEM_SOLD: {
    chemId: string
    quantity: number
    revenue: number
    profit: number
  }
  TURN_COMPLETED: {
    turn: number
    inDebt: boolean
  }
}

type Listener<T> = (payload: T) => void

class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>()

  on<K extends keyof GameEventMap>(type: K, fn: Listener<GameEventMap[K]>): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn as Listener<unknown>)
  }

  off<K extends keyof GameEventMap>(type: K, fn: Listener<GameEventMap[K]>): void {
    this.listeners.get(type)?.delete(fn as Listener<unknown>)
  }

  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    this.listeners.get(type)?.forEach(fn => fn(payload))
  }
}

export const gameBus = new EventBus()
