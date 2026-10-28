import { useCallback, useEffect, useState, type DependencyList } from 'react'

interface State<T> {
  data: T | null
  error: string | null
}

// Esegue una funzione async al mount e quando cambiano le deps; `reload()` la riesegue.
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<State<T> | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    fn().then(
      (data) => !cancelled && setState({ data, error: null }),
      (err: unknown) => !cancelled && setState({ data: null, error: errorMessage(err) }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { data: state?.data ?? null, error: state?.error ?? null, loading: state === null, reload }
}

// Rende "lanciabile" il risultato di una query Supabase: ritorna data o lancia l'errore.
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

const FRIENDLY: Record<string, string> = {
  '23503': 'Impossibile eliminare: questo elemento è ancora usato altrove (es. in un programma o nei log).',
  '42501': 'Operazione non permessa dalle regole di accesso del database.',
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string }
    if (e.code && FRIENDLY[e.code]) return FRIENDLY[e.code]
    if (e.message) return e.message
  }
  return String(err)
}
