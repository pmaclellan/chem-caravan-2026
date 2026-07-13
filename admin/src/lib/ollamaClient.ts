// Direct browser->Ollama calls for the run-insights feature, as a free/local alternative to
// anthropicClient.ts. Ollama runs entirely on your own machine (localhost:11434 by default) and
// needs no API key, but its default CORS policy typically blocks requests from a page whose
// origin isn't explicitly allowed — if calls fail with a network/CORS error in the browser
// console (not a normal HTTP error from this file), start Ollama with its origin allow-list
// opened for this dev server, e.g.:
//   OLLAMA_ORIGINS=http://localhost:5173 ollama serve
// See admin/.env.example for how to point this at a different host/model.

import type { ChatMessage } from './anthropicClient'
export type { ChatMessage }

const OLLAMA_URL = (import.meta.env.VITE_OLLAMA_URL as string | undefined) || 'http://localhost:11434'
// Defaults to a small 3B model rather than an 8B one: on a machine where other apps (browser,
// editor, dev servers) already have most of 16GB unified memory claimed, an 8B model's ~6GB
// footprint leaves Ollama no headroom to run on the GPU and pushes the whole system into swap —
// which looks like a hang (fans maxed, zero output for many minutes) but is actually just disk
// thrashing, confirmed via `ollama ps` showing "100% CPU" and Activity Monitor showing multiple
// GB of swap in use. A ~2GB model fits with room to spare regardless of what else is running.
// Override via VITE_OLLAMA_MODEL if your machine has more headroom and you want better quality.
export const OLLAMA_MODEL = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) || 'llama3.2:3b'
// Ollama's OpenAI-compatible endpoint doesn't expose context-window control, and its default
// context is small (often 2048-4096 tokens) regardless of what the model itself supports — a
// prompt bigger than that gets silently truncated, which reliably produces exactly the failure
// mode you'd expect: the model never actually sees most of the run data and falls back on generic
// pretrained knowledge instead. Using the native /api/chat endpoint instead so num_ctx can be set
// explicitly. Bigger costs more RAM (context size scales the KV cache directly) — lower this via
// VITE_OLLAMA_NUM_CTX if your machine struggles, but pair it with a smaller maxLogLines/
// maxSnapshotLines when building the prompt (see runSummary.ts) rather than raising this
// indefinitely, since a smaller model also just reasons better over a shorter, tighter prompt.
const OLLAMA_NUM_CTX = Number(import.meta.env.VITE_OLLAMA_NUM_CTX as string | undefined) || 4096
// Caps rambling — without a limit a small model that starts drifting off-topic can run for a very
// long time before stopping on its own.
const OLLAMA_NUM_PREDICT = 800

// Local models can be dramatically slower than a hosted API depending on the machine and prompt
// length, and a plain non-streaming call gives the UI nothing to show while it waits — a slow
// response and a hung one look identical. Streams instead, calling onToken as each chunk of text
// arrives, so the caller can render live progress instead of a static "please wait." Returns the
// full accumulated text once the stream ends.
export async function sendToOllama(
  messages: ChatMessage[],
  system: string,
  onToken?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
      stream: true,
      options: { num_ctx: OLLAMA_NUM_CTX, num_predict: OLLAMA_NUM_PREDICT },
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`)
  }
  if (!res.body) throw new Error('Ollama returned no response body.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Native /api/chat streams newline-delimited JSON (one object per line, no "data:" prefix or
    // [DONE] sentinel — the final object carries "done: true"). Buffer across reads since a chunk
    // boundary can land mid-line.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const chunk = JSON.parse(trimmed) as { message?: { content?: string }; error?: string }
        if (chunk.error) throw new Error(chunk.error)
        const delta = chunk.message?.content
        if (delta) {
          full += delta
          onToken?.(delta)
        }
      } catch (e) {
        if (e instanceof Error && trimmed.includes('"error"')) throw e
        // Otherwise an unparseable partial line — ignore rather than aborting the whole analysis.
      }
    }
  }

  return full || '(empty response)'
}

export type OllamaStatus =
  | { ok: true; modelAvailable: boolean; models: string[] }
  | { ok: false; error: string }

// Lets the UI tell apart "Ollama isn't running / CORS is blocking it" from "Ollama is running
// but the configured model hasn't been pulled yet" — two different fixes, worth distinguishing
// instead of surfacing one generic failure the first time someone tries this.
export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return { ok: false, error: `Ollama responded with ${res.status}` }
    const data = await res.json() as { models?: Array<{ name: string }> }
    const models = (data.models ?? []).map(m => m.name)
    const modelAvailable = models.some(m => m === OLLAMA_MODEL || m.startsWith(`${OLLAMA_MODEL}:`))
    return { ok: true, modelAvailable, models }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
