import { useState } from 'react'
import { errorMessage } from './useAsync'

type Op = () => PromiseLike<{ error: unknown }> | Promise<{ error: unknown }>

// Esegue una scrittura su Supabase, memorizza l'eventuale errore e al successo chiama onSuccess.
export function useAction(onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null)

  const run = async (op: Op) => {
    setError(null)
    try {
      const { error } = await op()
      if (error) throw error
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
    onSuccess()
    return true
  }

  return { run, error }
}
