import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, homeForRole } from './useAuth'
import type { Role } from '../types/database'
import FullScreenMessage from '../components/FullScreenMessage'

export default function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenMessage>Caricamento…</FullScreenMessage>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) return <FullScreenMessage error={profileError} showLogout />
  if (profile.role !== role) return <Navigate to={homeForRole(profile.role)} replace />

  return <>{children}</>
}
