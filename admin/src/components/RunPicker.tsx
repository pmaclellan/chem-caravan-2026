import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GameModeId, GameType } from '@main/types/game'
import { GAME_MODES } from '@main/data/modes'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { fetchPlayerDirectory, type PlayerOption } from '../lib/playerDirectory'

export interface RunSummary {
  id: string
  user_id: string
  character_name: string
  mode: string | null
  game_type: string
  status: 'active' | 'won' | 'dead' | 'bankrupt'
  final_score: number | null
  turns_reached: number | null
  created_at: string
  updated_at: string
  game_version: number | null
}

type DateField = 'created_at' | 'updated_at'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_COLOR: Record<RunSummary['status'], string> = {
  active: 'var(--pip-amber)',
  won: 'var(--pip-green)',
  dead: 'var(--pip-red)',
  bankrupt: 'var(--pip-red)',
}

const STATUSES: RunSummary['status'][] = ['active', 'won', 'dead', 'bankrupt']
const MODE_IDS: GameModeId[] = ['commonwealth', 'capital_wasteland', 'mojave_wasteland']
const GAME_TYPES: { id: GameType; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'free_play', label: 'Free Play' },
]
const RUN_LIMIT = 500

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

function Pill({ active, onClick, children, activeColor }: { active: boolean; onClick: () => void; children: ReactNode; activeColor?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] px-1.5 py-0.5 border rounded font-mono transition-colors"
      style={{
        borderColor: active ? (activeColor ?? 'var(--pip-green)') : 'var(--pip-border-dim)',
        color: active ? (activeColor ?? 'var(--pip-green)') : 'var(--pip-green-dim)',
        backgroundColor: active ? 'var(--pip-border-dim)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}

export default function RunPicker({ selectedId, onSelect }: Props) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nameFilter, setNameFilter] = useState('')
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedModes, setSelectedModes] = useState<GameModeId[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<RunSummary['status'][]>([])
  const [selectedGameTypes, setSelectedGameTypes] = useState<GameType[]>([])
  const [dateField, setDateField] = useState<DateField>('created_at')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [filtersOpen, setFiltersOpen] = useState(true)
  const [playerSearch, setPlayerSearch] = useState('')
  const [players, setPlayers] = useState<PlayerOption[] | null>(null)
  const [playersError, setPlayersError] = useState<string | null>(null)

  // Debounce the free-text name filter so it doesn't fire a query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNameFilter(nameFilter.trim()), 300)
    return () => clearTimeout(t)
  }, [nameFilter])

  // Player directory (email-labeled) — fetched once, independent of the active run filters, so
  // the picker's option list doesn't shrink/reorder as the user filters.
  useEffect(() => {
    let cancelled = false
    fetchPlayerDirectory()
      .then(list => { if (!cancelled) setPlayers(list) })
      .catch(e => { if (!cancelled) setPlayersError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  // All filtering happens server-side — the old version only ever filtered the already-fetched
  // 200-row window client-side, so a search for an older run silently found nothing if it had
  // aged out of that window. Re-queries whenever any filter changes.
  useEffect(() => {
    let cancelled = false
    setRuns(null)
    setError(null)
    let q = supabaseAdmin
      .from('games')
      .select('id, user_id, character_name, mode, game_type, status, final_score, turns_reached, created_at, updated_at, game_version', { count: 'exact' })
    if (selectedUserIds.length) q = q.in('user_id', selectedUserIds)
    if (selectedModes.length) q = q.in('mode', selectedModes)
    if (selectedStatuses.length) q = q.in('status', selectedStatuses)
    if (selectedGameTypes.length) q = q.in('game_type', selectedGameTypes)
    if (dateFrom) q = q.gte(dateField, `${dateFrom}T00:00:00.000Z`)
    if (dateTo) q = q.lte(dateField, `${dateTo}T23:59:59.999Z`)
    if (debouncedNameFilter) q = q.ilike('character_name', `%${debouncedNameFilter}%`)
    q.order(dateField, { ascending: false })
      .limit(RUN_LIMIT)
      .then(({ data, error, count }) => {
        if (cancelled) return
        if (error) { setError(error.message); return }
        setRuns((data ?? []) as RunSummary[])
        setTotalCount(count ?? null)
      })
    return () => { cancelled = true }
  }, [selectedUserIds, selectedModes, selectedStatuses, selectedGameTypes, dateField, dateFrom, dateTo, debouncedNameFilter])

  const filteredPlayers = useMemo(() => {
    if (!players) return []
    const q = playerSearch.trim().toLowerCase()
    if (!q) return players
    return players.filter(p => (p.email ?? '').toLowerCase().includes(q) || p.latestCharacterName.toLowerCase().includes(q))
  }, [players, playerSearch])

  const hasActiveFilters = nameFilter !== '' || selectedUserIds.length > 0 || selectedModes.length > 0 ||
    selectedStatuses.length > 0 || selectedGameTypes.length > 0 || dateFrom !== '' || dateTo !== ''

  const clearFilters = () => {
    setNameFilter('')
    setSelectedUserIds([])
    setSelectedModes([])
    setSelectedStatuses([])
    setSelectedGameTypes([])
    setDateFrom('')
    setDateTo('')
  }

  if (error) return <div className="pip-panel text-pip-red text-sm">Failed to load runs: {error}</div>

  return (
    <div className="pip-panel flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="pip-section-title text-lg">
          RUNS ({runs?.length ?? '…'}{totalCount !== null && runs && totalCount !== runs.length ? ` of ${totalCount}` : ''})
        </div>
        <button className="pip-btn text-[10px] py-0.5 px-1.5" onClick={() => setFiltersOpen(o => !o)}>
          {filtersOpen ? 'HIDE FILTERS' : 'FILTERS'}{hasActiveFilters ? ' *' : ''}
        </button>
      </div>

      <input
        className="pip-input mb-2 text-sm"
        placeholder="Filter by character name…"
        value={nameFilter}
        onChange={e => setNameFilter(e.target.value)}
      />

      {filtersOpen && (
        <div className="mb-2 border border-pip-border-dim rounded p-2 flex flex-col gap-2 text-[10px] font-mono">
          <div>
            <div className="text-pip-green-dim mb-1">Players{selectedUserIds.length > 0 ? ` (${selectedUserIds.length} selected)` : ''}</div>
            <input
              className="pip-input text-[10px] py-0.5 mb-1"
              placeholder="Search players…"
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
            />
            {playersError && <div className="text-pip-red">Failed to load players: {playersError}</div>}
            {!playersError && !players && <div className="text-pip-green-dim">Loading players…</div>}
            {players && (
              <div className="max-h-28 overflow-y-auto border border-pip-border-dim rounded">
                {filteredPlayers.map(p => (
                  <label key={p.userId} className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-pip-border-dim cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(p.userId)}
                      onChange={() => setSelectedUserIds(prev => toggle(prev, p.userId))}
                    />
                    <span className="flex-1 min-w-0">
                      <div className="text-pip-green truncate">{p.email ?? p.latestCharacterName}</div>
                      {p.email && <div className="text-pip-green-dim truncate text-[9px]">{p.latestCharacterName}</div>}
                    </span>
                  </label>
                ))}
                {filteredPlayers.length === 0 && <div className="text-pip-green-dim px-1.5 py-2">No players match.</div>}
              </div>
            )}
          </div>

          <div>
            <div className="text-pip-green-dim mb-1">Mode</div>
            <div className="flex gap-1 flex-wrap">
              {MODE_IDS.map(id => (
                <Pill key={id} active={selectedModes.includes(id)} onClick={() => setSelectedModes(prev => toggle(prev, id))}>
                  {GAME_MODES[id].name}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <div className="text-pip-green-dim mb-1">Status</div>
            <div className="flex gap-1 flex-wrap">
              {STATUSES.map(s => (
                <Pill key={s} active={selectedStatuses.includes(s)} activeColor={STATUS_COLOR[s]} onClick={() => setSelectedStatuses(prev => toggle(prev, s))}>
                  {s}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <div className="text-pip-green-dim mb-1">Type</div>
            <div className="flex gap-1 flex-wrap">
              {GAME_TYPES.map(t => (
                <Pill key={t.id} active={selectedGameTypes.includes(t.id)} onClick={() => setSelectedGameTypes(prev => toggle(prev, t.id))}>
                  {t.label}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <div className="text-pip-green-dim mb-1 flex items-center gap-1.5">
              Date range —
              <button className={`underline decoration-dotted ${dateField === 'created_at' ? 'text-pip-green' : 'text-pip-green-dim'}`} onClick={() => setDateField('created_at')}>Created</button>
              /
              <button className={`underline decoration-dotted ${dateField === 'updated_at' ? 'text-pip-green' : 'text-pip-green-dim'}`} onClick={() => setDateField('updated_at')}>Updated</button>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="date" className="pip-input text-[10px] py-0.5 flex-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-pip-green-dim">to</span>
              <input type="date" className="pip-input text-[10px] py-0.5 flex-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {hasActiveFilters && (
            <button className="pip-btn text-[10px] py-0.5 px-1.5 self-start" onClick={clearFilters}>CLEAR FILTERS</button>
          )}
        </div>
      )}

      {!runs && !error && <div className="text-sm text-pip-green-dim">Loading runs…</div>}

      {runs && (
        <>
          {totalCount !== null && totalCount > runs.length && (
            <div className="text-[10px] font-mono text-pip-amber mb-1">
              Showing newest {runs.length} of {totalCount} matching runs — narrow the filters to see the rest.
            </div>
          )}
          <div className="flex-1 overflow-y-auto min-h-0 text-xs font-mono">
            {runs.map(r => (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="w-full text-left px-2 py-1.5 border-b border-pip-border-dim hover:bg-pip-border-dim transition-colors"
                style={{ backgroundColor: r.id === selectedId ? 'var(--pip-border-dim)' : undefined }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-pip-green truncate">{r.character_name}</span>
                  <span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span>
                </div>
                <div className="text-pip-green-dim text-[10px] flex items-center justify-between">
                  <span>{r.mode ?? '—'} · {r.game_type} · turn {r.turns_reached ?? '?'}</span>
                  <span>{new Date(dateField === 'created_at' ? r.created_at : r.updated_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
            {runs.length === 0 && <div className="text-pip-green-dim px-2 py-4">No runs match.</div>}
          </div>
        </>
      )}
    </div>
  )
}
