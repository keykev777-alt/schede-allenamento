import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errorMessage, must, useAsync } from '../../lib/useAsync'
import { useAction } from '../../lib/useAction'
import { deleteProgram, formatDate } from '../../lib/programs'
import { useAuth } from '../../auth/useAuth'
import type { Profile, Program } from '../../types/database'
import ProgramForm from './ProgramForm'

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>()
  const { session } = useAuth()
  const trainerId = session!.user.id
  const navigate = useNavigate()

  const { data, error, loading, reload } = useAsync(async () => {
    const [client, programs] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', clientId!).maybeSingle(),
      supabase
        .from('programs')
        .select('*')
        .eq('client_id', clientId!)
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false }),
    ])
    return { client: must(client) as Profile | null, programs: must(programs) as Program[] }
  }, [clientId, trainerId])

  const { run, error: actionError } = useAction(reload)

  const toggleActive = (p: Program) =>
    run(() => supabase.from('programs').update({ is_active: !p.is_active }).eq('id', p.id))

  const remove = (p: Program) => {
    if (!window.confirm(`Eliminare il programma "${p.name}" con tutti i suoi giorni ed esercizi?`))
      return
    run(() => deleteProgram(p.id))
  }

  if (loading) return <p className="muted">Caricamento…</p>
  if (error) return <p className="error">{error}</p>
  if (!data?.client) return <p className="error">Cliente non trovato.</p>

  return (
    <>
      <Link to="/trainer" className="small">
        ← Clienti
      </Link>
      <h1>{data.client.full_name || 'Cliente senza nome'}</h1>

      <section className="card stack">
        <h2>Nuovo programma</h2>
        <ProgramForm
          submitLabel="Crea e apri"
          onSubmit={async (values) => {
            const res = await supabase
              .from('programs')
              .insert({ ...values, client_id: clientId, trainer_id: trainerId })
              .select('id')
              .single()
            if (res.error) return errorMessage(res.error)
            navigate(`/trainer/programmi/${res.data.id}`)
            return null
          }}
        />
      </section>

      <h2>Programmi</h2>
      {actionError && <p className="error">{actionError}</p>}
      {data.programs.length === 0 && (
        <p className="muted">Nessun programma assegnato a questo cliente.</p>
      )}
      <ul className="list">
        {data.programs.map((p) => (
          <li key={p.id} className="list-item">
            <div>
              <Link to={`/trainer/programmi/${p.id}`}>{p.name}</Link>{' '}
              {p.is_active ? (
                <span className="badge">attivo</span>
              ) : (
                <span className="badge badge-off">non attivo</span>
              )}
              <div className="muted small">
                {formatDate(p.start_date) ?? '—'} → {formatDate(p.end_date) ?? '—'}
              </div>
            </div>
            <div className="row">
              <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(p)}>
                {p.is_active ? 'Disattiva' : 'Attiva'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                Elimina
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
