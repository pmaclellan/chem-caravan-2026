import { useEffect, useState } from 'react'

// Shown on the disabled recap button while run-summary.mts is in flight (GameOverScreen + MyRuns).
// Cycles through wasteland-flavored status lines the same beat as Claude Code's CLI spinner or a
// Sims loading screen tip — something to read during the ~2-7s Anthropic call instead of a static
// "ANALYZING YOUR RUN...". Each phrase remounts its span (via key={index}) to re-trigger the CSS
// fade-in keyframe — the same restart-via-remount trick FlashOverlay uses for its own animations.
const PHRASES = [
  'Analyzing your run',
  'Auditing your caps',
  'Interrogating your guards',
  'Cross-referencing the ledger',
  'Reading the wasteland tea leaves',
  'Consulting a Mister Handy',
  'Grading your trade routes',
  'Reviewing the Pip-Boy logs',
  'Weighing your life choices',
  'Counting bottle caps by hand',
]

const PHRASE_INTERVAL_MS = 3400

export default function AnalyzingIndicator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % PHRASES.length), PHRASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="uppercase">
      <span key={index} className="pip-phrase-fade">{PHRASES[index]}</span>
      <span className="pip-loading-dots" aria-hidden="true">
        <span>.</span><span>.</span><span>.</span>
      </span>
    </span>
  )
}
