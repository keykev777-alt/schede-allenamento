import { useContext } from 'react'
import { AuthContext } from './context'
import type { Role } from '../types/database'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro <AuthProvider>')
  return ctx
}

export function homeForRole(role: Role) {
  return role === 'trainer' ? '/trainer' : '/app'
}
