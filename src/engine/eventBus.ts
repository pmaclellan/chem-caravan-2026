export type GameEventMap = {
  COMBAT_RESOLVED: {
    outcome: 'won' | 'fled' | 'lost'
    killedEnemies: Array<{ typeId: string }>
    weaponId: string | null
    damageDealt: number
    damageTaken: number
    capsLooted: number
    waveNumber: number          // 1 = normal, 2 = second wave, 3+ = future
    isCheckpointFight: boolean
  }
  CHEM_SOLD: {
    chemId: string
    quantity: number
    revenue: number
    profit: number
    channel: 'market' | 'merchant' | 'desperate_buyer'
  }
  CHEM_BOUGHT: {
    chemId: string
    quantity: number
    pricePaid: number
  }
  TAME_COMPLETED: {
    enemyTypeId: string
  }
  TURN_COMPLETED: {
    turn: number
    inDebt: boolean
  }
  ACHIEVEMENT_UNLOCKED: {
    achievementId: string
    xpAwarded: number
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
