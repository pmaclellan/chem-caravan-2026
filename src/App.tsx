import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Home from './pages/Home'
import Game from './pages/Game'
import Leaderboard from './pages/Leaderboard'
import HowToPlayPage from './pages/HowToPlay'
import SetPasswordModal from './components/auth/SetPasswordModal'
import { VersionFooter } from './components/ui/VersionFooter'
import RouteErrorBoundary from './components/ui/RouteErrorBoundary'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-pip-green font-display text-2xl">LOADING...</div>
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/game', element: <ProtectedRoute><Game /></ProtectedRoute> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/how-to-play', element: <HowToPlayPage /> },
    ],
  },
])

export default function App() {
  const initialize = useAuthStore(s => s.initialize)
  useEffect(() => { initialize() }, [initialize])
  return (
    <>
      <RouterProvider router={router} />
      <SetPasswordModal />
      <VersionFooter />
    </>
  )
}
