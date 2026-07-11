import { useEffect, useState } from 'react'
import { supabaseAdmin } from '../lib/supabaseAdmin'

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

export default function RunPicker({ selectedId, onSelect }: Props) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    supabaseAdmin
      .from('games')
      .select('id, user_id, character_name, mode, game_type, status, final_score, turns_reached, created_at, updated_at, game_version')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setError(error.message); return }
        setRuns((data ?? []) as RunSummary[])
      })
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="pip-panel text-pip-red text-sm">Failed to load runs: {error}</div>
  if (!runs) return <div className="pip-panel text-sm text-pip-green-dim">Loading runs…</div>

  const filtered = filter
    ? runs.filter(r => r.character_name.toLowerCase().includes(filter.toLowerCase()))
    : runs

  return (
    <div className="pip-panel flex flex-col h-full min-h-0">
      <div className="pip-section-title text-lg">RUNS ({filtered.length})</div>
      <input
        className="pip-input mb-2 text-sm"
        placeholder="Filter by character name…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="flex-1 overflow-y-auto min-h-0 text-xs font-mono">
        {filtered.map(r => (
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
              <span>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div className="text-pip-green-dim px-2 py-4">No runs match.</div>}
      </div>
    </div>
  )
}
