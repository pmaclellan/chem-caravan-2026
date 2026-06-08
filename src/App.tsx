import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Home from './pages/Home'
import Game from './pages/Game'
import Leaderboard from './pages/Leaderboard'
import HowToPlayPage from './pages/HowToPlay'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-pip-green font-display text-2xl">LOADING...</div>
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/game', element: <ProtectedRoute><Game /></ProtectedRoute> },
  { path: '/leaderboard', element: <Leaderboard /> },
  { path: '/how-to-play', element: <HowToPlayPage /> },
])

export default function App() {
  const initialize = useAuthStore(s => s.initialize)
  useEffect(() => { initialize() }, [initialize])
  return <RouterProvider router={router} />
}
