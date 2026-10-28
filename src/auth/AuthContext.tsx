import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import { AuthContext } from './context'

interface LoadedProfile {
  userId: string
  profile: Profile | null
  error: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null)

  // Sessione: lettura iniziale + sincronizzazione su login/logout/refresh token
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Niente chiamate Supabase qui dentro: il profilo viene caricato nell'effect sotto
      setSession(newSession)
      setSessionReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Profilo: ricaricato solo quando cambia l'utente, non ad ogni refresh del token
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoaded({
          userId,
          profile: data as Profile | null,
          error: error ? error.message : data ? null : 'Nessun profilo associato a questo account.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Il profilo caricato vale solo se appartiene all'utente della sessione corrente
  const current = userId && loaded?.userId === userId ? loaded : null
  const loading = !sessionReady || (!!userId && !current)

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile: current?.profile ?? null,
        loading,
        profileError: current?.error ?? null,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
