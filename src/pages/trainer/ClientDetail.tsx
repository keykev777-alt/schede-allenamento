import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errorMessage, must, useAsync } from '../../lib/useAsync'
import { useAction } from '../../lib/useAction'
import { deleteProgram, duplicateProgram, formatDate } from '../../lib/programs'
import { useAuth } from '../../auth/useAuth'
import type { Profile, Program } from '../../types/database'
import ProgramForm from './ProgramForm'

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>()
  const { session } = useAuth()
  const trainerId = session!.user.id
  const navigate = useNavigate()

  const { data, error, loading, reload } = useAsync(async () => {
    const [client, programs, clients] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', clientId!).maybeSingle(),
      supabase
        .from('programs')
        .select('*')
        .eq('client_id', clientId!)
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false }),
      // Tutti i clienti, per scegliere a chi assegnare un programma duplicato
      supabase.from('profiles').select('*').eq('role', 'client').order('full_name'),
    ])
    return {
      client: must(client) as Profile | null,
      programs: must(programs) as Program[],
      clients: must(clients) as Profile[],
    }
  }, [clientId, trainerId])

  const { run, error: actionError } = useAction(reload)
  // id del programma per cui è aperto il form "Duplica"
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

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
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDuplicatingId(duplicatingId === p.id ? null : p.id)}
              >
                Duplica
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                Elimina
              </button>
            </div>
            {duplicatingId === p.id && (
              <DuplicateProgramForm
                program={p}
                clients={data.clients}
                onCancel={() => setDuplicatingId(null)}
                onDone={(id) => navigate(`/trainer/programmi/${id}`)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function DuplicateProgramForm({
  program,
  clients,
  onCancel,
  onDone,
}: {
  program: Program
  clients: Profile[]
  onCancel: () => void
  onDone: (newProgramId: string) => void
}) {
  const [clientId, setClientId] = useState(program.client_id)
  const [name, setName] = useState(`${program.name} (copia)`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await duplicateProgram(program, { clientId, name: name.trim() })
    if (res.id === null) {
      setError(errorMessage(res.error))
      setSaving(false)
    } else onDone(res.id)
  }

  return (
    <form className="form-grid card span-row" onSubmit={handleSubmit}>
      <label>
        Assegna a
        <select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || 'Senza nome'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nome del nuovo programma
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="muted small span-all">
        La copia sarà non attiva e senza date: potrai impostarle nell'editor.
      </p>
      {error && <p className="error span-all">{error}</p>}
      <div className="row form-actions">
        <button className="btn" disabled={saving}>
          {saving ? 'Duplicazione…' : 'Duplica e apri'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>
          Annulla
        </button>
      </div>
    </form>
  )
}
