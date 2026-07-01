import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

type Mode = 'signin' | 'signup' | 'recover'

interface Props { onClose?: () => void }

export default function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const { signIn, signUp, sendPasswordReset, isLoading, error, clearError } = useAuthStore()

  function switchMode(next: Mode) {
    clearError()
    setResetSent(false)
    setMode(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()

    if (mode === 'recover') {
      const ok = await sendPasswordReset(email)
      if (ok) setResetSent(true)
      return
    }

    const ok = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    if (ok) onClose?.()
  }

  const title =
    mode === 'signin'  ? 'ENTER THE WASTELAND' :
    mode === 'signup'  ? 'CREATE ACCOUNT' :
                         'RECOVER ACCOUNT'

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
        <div className="pip-section-title mb-4">{title}</div>

        {/* Mode tabs — hidden in recover flow */}
        {mode !== 'recover' && (
          <div className="flex gap-2 mb-4">
            <button
              className={mode === 'signin' ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
              onClick={() => switchMode('signin')}
            >
              SIGN IN
            </button>
            <button
              className={mode === 'signup' ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
              onClick={() => switchMode('signup')}
            >
              REGISTER
            </button>
          </div>
        )}

        {/* Recover: success state */}
        {mode === 'recover' && resetSent ? (
          <div className="space-y-4">
            <div className="text-pip-green text-sm border border-pip-green p-3 rounded">
              Check your email — a reset link is on its way. Follow it to set a new password.
            </div>
            <button className="pip-btn w-full" onClick={() => switchMode('signin')}>
              BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="pip-label block mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pip-input w-full"
                placeholder="survivor@commonwealth.net"
                autoComplete="email"
              />
            </div>

            {mode !== 'recover' && (
              <div>
                <label className="pip-label block mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pip-input w-full"
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            {error && (
              <div className="text-pip-red text-xs border border-pip-red p-2 rounded">{error}</div>
            )}

            <button type="submit" className="pip-btn w-full" disabled={isLoading}>
              {isLoading
                ? 'CONNECTING...'
                : mode === 'signin'   ? 'SIGN IN'
                : mode === 'signup'   ? 'CREATE ACCOUNT'
                :                       'SEND RESET LINK'}
            </button>

            {mode === 'signin' && (
              <button
                type="button"
                className="text-pip-green-dim text-xs w-full text-center hover:text-pip-green transition-colors"
                onClick={() => switchMode('recover')}
              >
                Forgot password?
              </button>
            )}

            {mode === 'recover' && (
              <button
                type="button"
                className="text-pip-green-dim text-xs w-full text-center hover:text-pip-green transition-colors"
                onClick={() => switchMode('signin')}
              >
                Back to sign in
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
