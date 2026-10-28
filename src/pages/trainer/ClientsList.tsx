import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import { useAuth } from '../../auth/useAuth'
import type { Profile, Program } from '../../types/database'

export default function ClientsList() {
  const { session } = useAuth()
  const trainerId = session!.user.id

  const { data, error, loading } = useAsync(async () => {
    const [clients, programs] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'client').order('full_name'),
      supabase.from('programs').select('client_id, is_active').eq('trainer_id', trainerId),
    ])
    return {
      clients: must(clients) as Profile[],
      programs: must(programs) as Pick<Program, 'client_id' | 'is_active'>[],
    }
  }, [trainerId])

  return (
    <>
      <h1>Clienti</h1>
      {loading && <p className="muted">Caricamento…</p>}
      {error && <p className="error">{error}</p>}
      {data && data.clients.length === 0 && (
        <p className="muted">
          Nessun cliente trovato. I clienti sono gli utenti con <code>role = 'client'</code> nella
          tabella profiles.
        </p>
      )}
      {data && data.clients.length > 0 && (
        <ul className="list">
          {data.clients.map((c) => {
            const mine = data.programs.filter((p) => p.client_id === c.id)
            const active = mine.filter((p) => p.is_active).length
            return (
              <li key={c.id}>
                <Link to={`/trainer/clienti/${c.id}`} className="list-item">
                  <span>{c.full_name || 'Senza nome'}</span>
                  <span className="muted small">
                    {active > 0 ? (
                      <span className="badge">{active} attivo{active > 1 ? 'i' : ''}</span>
                    ) : null}{' '}
                    {mine.length} programm{mine.length === 1 ? 'a' : 'i'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
