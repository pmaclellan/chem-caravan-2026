import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

interface Props { onClose?: () => void }

export default function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, signUp, isLoading, error, clearError } = useAuthStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password)
    }
    onClose?.()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
          <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
      </div>
      <div className="absolute inset-0 bg-pip-bg opacity-30" />
      <div className="relative pip-panel w-full max-w-sm">
        <div className="pip-section-title mb-4">
          {mode === 'signin' ? 'ENTER THE WASTELAND' : 'CREATE ACCOUNT'}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={mode === 'signin' ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
            onClick={() => setMode('signin')}
          >
            SIGN IN
          </button>
          <button
            className={mode === 'signup' ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
            onClick={() => setMode('signup')}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pip-label block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pip-input w-full"
              placeholder="survivor@commonwealth.net"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="pip-label block mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pip-input w-full"
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="text-pip-red text-xs border border-pip-red p-2 rounded">{error}</div>
          )}

          <button type="submit" className="pip-btn w-full" disabled={isLoading}>
            {isLoading ? 'CONNECTING...' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  )
}
