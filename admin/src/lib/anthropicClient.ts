// Direct browser->Anthropic API calls for the run-insights feature. This is safe in the SAME
// way the Supabase service-role key is safe here: admin/ is a local-only app never bundled into
// the public build (see admin/.env.example), so a key placed in admin/.env.local never leaves
// your machine. Unlike supabaseAdmin.ts, this does NOT throw at import time if the key is
// missing — insights are an optional feature, not a hard requirement to use the rest of the tool.

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
const model = (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined) || 'claude-sonnet-5'

export const hasAnthropicKey = !!apiKey

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendToClaude(messages: ChatMessage[], system: string, signal?: AbortSignal): Promise<string> {
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_API_KEY — add it to admin/.env.local to use run insights.')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${text || res.statusText}`)
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return data.content?.find(c => c.type === 'text')?.text ?? '(empty response)'
}
