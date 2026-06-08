import { GAME_MODES } from '../../data/modes'
import { useGameStore } from '../../store/gameStore'
import type { PlayerState } from '../../types/game'
import SettlementMap from './SettlementMap'

interface Props { player: PlayerState }

export default function MapPanel({ player }: Props) {
  const travelTo = useGameStore(s => s.travelTo)
  const mode     = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc       = GAME_MODES[mode]

  return <SettlementMap player={player} mc={mc} onTravel={travelTo} />
}
