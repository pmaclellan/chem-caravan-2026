import { useEffect, useRef, useState } from 'react'
import type { GameRow, GameState } from '@main/types/game'
import { hasAnthropicKey, sendToClaude, type ChatMessage } from '../lib/anthropicClient'
import { sendToOllama, checkOllamaStatus, OLLAMA_MODEL, type OllamaStatus } from '../lib/ollamaClient'
import { ANALYSIS_SYSTEM_PROMPT, buildRunSummaryForAnalysis } from '../lib/runSummary'

type Provider = 'anthropic' | 'ollama'

interface Props {
  row: GameRow
  gameState: GameState
}

// Chat turn 0 (the run-data dump) is never rendered directly — it's the analysis prompt, not
// something worth reading. Everything from turn 1 onward (the reply, follow-up Q&A) is a normal
// chat bubble.
export default function RunInsights({ row, gameState }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    checkOllamaStatus().then(status => { if (!cancelled) setOllamaStatus(status) })
    return () => { cancelled = true }
  }, [])

  // Local models can take a long time depending on the machine and prompt length, and with no
  // feedback a slow response and a hung one look identical. This ticks while a request is in
  // flight so there's always a visible sign of life; Ollama also streams its reply token-by-token
  // (see below) so text visibly grows instead of appearing all at once at the end.
  useEffect(() => {
    if (!loading) return
    setElapsedSeconds(0)
    const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [loading])

  const started = messages.length > 0

  const runProviderCall = async (next: ChatMessage[], useProvider: Provider) => {
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setProvider(useProvider)
    setMessages(next)
    try {
      if (useProvider === 'anthropic') {
        const reply = await sendToClaude(next, ANALYSIS_SYSTEM_PROMPT, controller.signal)
        setMessages([...next, { role: 'assistant', content: reply }])
      } else {
        setMessages([...next, { role: 'assistant', content: '' }])
        await sendToOllama(next, ANALYSIS_SYSTEM_PROMPT, delta => {
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = { ...last, content: last.content + delta }
            return updated
          })
        }, controller.signal)
      }
    } catch (e) {
      // Drop a still-empty streaming placeholder rather than leaving a blank bubble behind.
      setMessages(prev => {
        const last = prev[prev.length - 1]
        return last?.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev
      })
      setError(controller.signal.aborted ? 'Cancelled.' : e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const runAnalysis = (useProvider: Provider) => {
    // A weak local model given a huge unstructured dump tends to lose the thread — trim much
    // harder for Ollama than the default (tuned for a large-context hosted model) so the whole
    // prompt reliably fits inside num_ctx (see ollamaClient.ts) and the model isn't drowning in
    // more data than it can actually reason over.
    const summary = useProvider === 'ollama'
      ? buildRunSummaryForAnalysis(row, gameState, 250, 60)
      : buildRunSummaryForAnalysis(row, gameState)
    void runProviderCall([{ role: 'user', content: summary }], useProvider)
  }

  const askFollowUp = () => {
    const q = question.trim()
    if (!q || loading || !provider) return
    setQuestion('')
    void runProviderCall([...messages, { role: 'user', content: q }], provider)
  }

  const cancel = () => abortRef.current?.abort()

  const startOver = () => {
    abortRef.current?.abort()
    setMessages([])
    setProvider(null)
    setError(null)
  }

  const ollamaHint = !ollamaStatus
    ? 'Checking for Ollama…'
    : !ollamaStatus.ok
      ? `Ollama not detected at localhost:11434 (${ollamaStatus.error}). Install it and run "ollama serve".`
      : !ollamaStatus.modelAvailable
        ? `Ollama is running, but model "${OLLAMA_MODEL}" isn't pulled yet — run "ollama pull ${OLLAMA_MODEL}".`
        : `Ollama ready — model "${OLLAMA_MODEL}".`
  const ollamaReady = ollamaStatus?.ok && ollamaStatus.modelAvailable

  return (
    <div className="pip-panel h-full flex flex-col min-h-0">
      {!started && (
        <div className="flex-1 flex items-center justify-start flex-col gap-3 pt-8">
          <p className="text-xs font-mono text-pip-green-dim max-w-sm text-center">
            Sends this run's stats, per-turn snapshots, road traversals, and notable log events for a
            standard analysis.
          </p>
          <div className="flex gap-2">
            <button className="pip-btn" onClick={() => runAnalysis('anthropic')} disabled={loading || !hasAnthropicKey}>
              ANALYZE WITH CLAUDE
            </button>
            <button className="pip-btn" onClick={() => runAnalysis('ollama')} disabled={loading || !ollamaReady}>
              ANALYZE WITH LOCAL LLM
            </button>
          </div>
          <p className="text-[10px] font-mono text-pip-green-dim max-w-sm text-center">
            {!hasAnthropicKey && <>Claude needs VITE_ANTHROPIC_API_KEY in admin/.env.local (costs real API usage). </>}
            {ollamaHint}
          </p>
        </div>
      )}

      {started && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-pip-green-dim">via {provider === 'anthropic' ? 'Claude' : `Local LLM (${OLLAMA_MODEL})`}</div>
            <button className="pip-btn text-[10px] py-0.5 px-1.5" onClick={startOver}>NEW ANALYSIS</button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-3 pb-2">
            {messages.slice(1).map((m, i) => (
              <div
                key={i}
                className={`text-xs font-mono whitespace-pre-wrap rounded p-2 border ${
                  m.role === 'user'
                    ? 'border-pip-blue text-pip-blue self-end max-w-[80%]'
                    : 'border-pip-border-dim text-pip-green max-w-[90%]'
                }`}
              >
                {m.content}
                {loading && m.role === 'assistant' && i === messages.slice(1).length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-pip-green-dim align-middle ml-0.5 animate-pulse" />
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs font-mono text-pip-green-dim">
                <span>{provider === 'ollama' ? 'Generating' : 'Thinking'}… {elapsedSeconds}s</span>
                <button className="pip-btn text-[10px] py-0.5 px-1.5" onClick={cancel}>CANCEL</button>
              </div>
            )}
          </div>
        </>
      )}

      {error && <div className="text-pip-red text-xs font-mono mb-2">{error}</div>}

      {started && (
        <div className="flex gap-2 pt-2 border-t border-pip-border">
          <input
            className="pip-input text-xs flex-1"
            placeholder="Ask a follow-up question about this run…"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') askFollowUp() }}
            disabled={loading}
          />
          <button className="pip-btn text-xs py-1 px-3" onClick={askFollowUp} disabled={loading || !question.trim()}>ASK</button>
        </div>
      )}
    </div>
  )
}
