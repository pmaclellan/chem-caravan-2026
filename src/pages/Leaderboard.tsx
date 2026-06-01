import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface LeaderboardRow {
  character_name: string
  final_score: number
  status: string
  created_at: string
  rank: number
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_leaderboard')
      if (error) setError(error.message)
      else setRows((data as LeaderboardRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-4xl text-pip-green tracking-widest">LEADERBOARD</h1>
          <button className="pip-btn" onClick={() => navigate('/')}>BACK</button>
        </div>

        {loading && <div className="text-pip-green-dim">LOADING DATA...</div>}
        {error && <div className="text-pip-red">Error: {error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-pip-green-dim">No finished runs yet. Be the first!</div>
        )}

        {rows.length > 0 && (
          <div className="pip-panel">
            <div className="grid grid-cols-5 gap-2 text-pip-green-dim text-xs uppercase tracking-widest border-b border-pip-border pb-2 mb-2">
              <div>#</div>
              <div className="col-span-2">Name</div>
              <div>Score</div>
              <div>Result</div>
            </div>
            {rows.map(row => (
              <div key={`${row.rank}-${row.character_name}`} className="grid grid-cols-5 gap-2 text-sm py-1 border-b border-pip-border-dim">
                <div className={`font-display text-lg ${row.rank === 1 ? 'text-pip-amber' : row.rank <= 3 ? 'text-pip-green-mid' : 'text-pip-green-dim'}`}>
                  {row.rank}
                </div>
                <div className="col-span-2 text-pip-green">{row.character_name}</div>
                <div className={`font-display text-lg ${row.final_score >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
                  {row.final_score.toLocaleString()} ¤
                </div>
                <div className={`text-xs uppercase ${row.status === 'won' ? 'text-pip-green' : 'text-pip-red'}`}>
                  {row.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
