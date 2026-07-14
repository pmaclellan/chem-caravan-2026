import type { Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { GameState, GameType } from '@main/types/game'
import { normalizeState } from '@main/engine/normalizeState'
import { buildRunPlaystyleDigest, buildPlayerBaselineProfile, type BaselineRow } from './_lib/runDigest.ts'
import { RECAP_SYSTEM_PROMPT, buildRecapUserPrompt } from './_lib/prompts.ts'

// No VITE_ prefix needed for these: that's a Vite build-time convention (which vars get baked
// into the client bundle), not a Netlify access-control mechanism — Functions can read any site
// env var regardless of prefix, and the Supabase anon key isn't secret in the first place. Reused
// as-is rather than duplicating into new aliases, so there's only one URL/key to keep in sync.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const BASELINE_ROW_LIMIT = 20

type RunSummaryResponse =
  | { available: true; summary: string; meta: { model: string; baselineRunCount: number } }
  | {
      available: false
      reason: 'not_configured' | 'unauthorized' | 'not_found' | 'not_game_over' | 'upstream_error' | 'invalid_request'
    }

function json(body: RunSummaryResponse, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

interface GameRowSubset {
  id: string
  user_id: string
  character_name: string
  mode: string | null
  game_type: GameType
  status: 'active' | 'won' | 'dead' | 'bankrupt'
  state: GameState
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'POST') return json({ available: false, reason: 'invalid_request' }, 400)

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return json({ available: false, reason: 'unauthorized' }, 401)

  let gameId: string
  try {
    const body = await req.json() as { gameId?: unknown }
    if (!body || typeof body.gameId !== 'string' || !body.gameId) throw new Error('missing gameId')
    gameId = body.gameId
  } catch {
    return json({ available: false, reason: 'invalid_request' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) return json({ available: false, reason: 'unauthorized' }, 401)
  const userId = userData.user.id

  try {
    const fetchRow = () =>
      supabase.from('games').select('id,user_id,character_name,mode,game_type,status,state').eq('id', gameId).single()

    let { data: row, error: rowError } = await fetchRow()
    if (rowError || !row) return json({ available: false, reason: 'not_found' }, 404)
    let typedRow = row as GameRowSubset
    if (typedRow.user_id !== userId) return json({ available: false, reason: 'not_found' }, 404)

    // The client debounces saves ~400ms after every mutation, so the row may not yet reflect a
    // just-finished run at the instant the Game Over screen mounts. Client-side gating (only
    // enabling the recap button once the screen's reveal animation reaches its final phase, well
    // past that debounce) is the primary defense — this is a one-shot retry as a backstop.
    if (typedRow.state?.phase !== 'game_over') {
      await new Promise(resolve => setTimeout(resolve, 600))
      const retry = await fetchRow()
      if (retry.error || !retry.data || (retry.data as GameRowSubset).state?.phase !== 'game_over') {
        return json({ available: false, reason: 'not_game_over' }, 200)
      }
      typedRow = retry.data as GameRowSubset
    }

    const state = normalizeState(typedRow.state)
    const outcome = typedRow.status === 'active' ? 'dead' : typedRow.status
    const runDigest = buildRunPlaystyleDigest(state, outcome)

    const { data: baselineRows, error: baselineError } = await supabase
      .from('games')
      .select('status,final_score,turns_reached,mode,game_type,created_at,stats:state->stats')
      .eq('user_id', userId)
      .eq('game_type', typedRow.game_type)
      .neq('id', gameId)
      .neq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(BASELINE_ROW_LIMIT)

    if (baselineError) throw baselineError
    const baseline = buildPlayerBaselineProfile((baselineRows ?? []) as unknown as BaselineRow[], typedRow.game_type)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return json({ available: false, reason: 'not_configured' })

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system: RECAP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildRecapUserPrompt(runDigest, baseline) }],
      },
      { timeout: 7500 },
    )

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const summary = textBlock?.text?.trim()
    if (!summary) return json({ available: false, reason: 'upstream_error' })

    return json({ available: true, summary, meta: { model: ANTHROPIC_MODEL, baselineRunCount: baseline.runCount } })
  } catch (err) {
    console.error('run-summary function error:', err)
    return json({ available: false, reason: 'upstream_error' })
  }
}
