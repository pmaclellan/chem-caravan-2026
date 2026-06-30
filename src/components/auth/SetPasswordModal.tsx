import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

export default function SetPasswordModal() {
  const { isPasswordRecovery, updatePassword, isLoading, error, clearError } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  if (!isPasswordRecovery) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMatchError(null)
    clearError()
    if (password !== confirm) {
      setMatchError("Passwords don't match.")
      return
    }
    const ok = await updatePassword(password)
    if (ok) setDone(true)
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-10 sm:items-center sm:pb-0 px-4 pt-4 z-50 overflow-hidden">
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
          <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
      </div>
      <div className="absolute inset-0 bg-pip-bg opacity-30" />
      <h1
        className="absolute left-0 right-0 text-center font-display tracking-widest pointer-events-none"
        style={{
          top: 'clamp(12px, 3vh, 32px)',
          fontSize: 'clamp(2.5rem, 9vw, 5.5rem)',
          color: '#1a2d0e',
          WebkitTextStroke: '0.75px #1a2d0e',
        }}
      >
        CHEM CARAVAN
      </h1>
      <div className="relative pip-panel w-full max-w-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 75%, transparent)' }}>
        <div className="pip-section-title mb-4">SET NEW PASSWORD</div>

        {done ? (
          <div className="space-y-4">
            <div className="text-pip-green text-sm border border-pip-green p-3 rounded">
              Password updated. You're back in the wasteland.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="pip-label block mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pip-input w-full"
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div>
              <label className="pip-label block mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="pip-input w-full"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {(matchError || error) && (
              <div className="text-pip-red text-xs border border-pip-red p-2 rounded">
                {matchError ?? error}
              </div>
            )}

            <button type="submit" className="pip-btn w-full" disabled={isLoading}>
              {isLoading ? 'SAVING...' : 'SET PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
