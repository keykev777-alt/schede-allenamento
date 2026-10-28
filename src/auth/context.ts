import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'

export interface AuthState {
  session: Session | null
  profile: Profile | null
  // true finché non sappiamo ancora se c'è una sessione e (se c'è) il suo profilo
  loading: boolean
  profileError: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
