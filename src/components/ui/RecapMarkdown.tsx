import ReactMarkdown, { type Components } from 'react-markdown'

// Shared by GameOverScreen, MyRuns, and the admin tool's RunInsights (via the @main alias) — all
// three render the same AI-generated Wasteland Recap markdown. Uses react-markdown (renders to
// real React elements, no dangerouslySetInnerHTML) rather than a hand-rolled parser: the recap
// text is LLM output, and even a carefully-prompted model can drift from the exact expected
// shape, so a real parser degrades gracefully instead of leaking raw asterisks/hashes.
const RECAP_MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <div className="font-display text-pip-amber text-xl mb-2 tracking-wide">{children}</div>,
  h2: ({ children }) => <div className="font-display text-pip-amber text-xl mb-2 tracking-wide">{children}</div>,
  h3: ({ children }) => <div className="font-display text-pip-amber text-lg mb-1.5 tracking-wide">{children}</div>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3 list-none">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-3 list-none">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm text-pip-green leading-snug pl-2.5 border-l-2 border-pip-border-dim">{children}</li>
  ),
  p: ({ children }) => <p className="text-sm text-pip-green leading-relaxed mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-pip-amber font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-pip-green-dim italic">{children}</em>,
}

export function RecapMarkdown({ text }: { text: string }) {
  return (
    <div className="font-mono">
      <ReactMarkdown components={RECAP_MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
    </div>
  )
}
