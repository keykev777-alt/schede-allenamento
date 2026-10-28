import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import { useAction } from '../../lib/useAction'
import { useAuth } from '../../auth/useAuth'
import type { Exercise } from '../../types/database'

type ExerciseInput = Pick<Exercise, 'name' | 'muscle_group' | 'video_url' | 'notes'>

export default function Exercises() {
  const { session } = useAuth()
  const trainerId = session!.user.id
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, error, loading, reload } = useAsync(
    async () =>
      must(
        await supabase.from('exercises').select('*').eq('trainer_id', trainerId).order('name'),
      ) as Exercise[],
    [trainerId],
  )
  const { run, error: actionError } = useAction(reload)

  const create = (values: ExerciseInput) =>
    run(() => supabase.from('exercises').insert({ ...values, trainer_id: trainerId }))

  const update = async (id: string, values: ExerciseInput) => {
    const ok = await run(() => supabase.from('exercises').update(values).eq('id', id))
    if (ok) setEditingId(null)
    return ok
  }

  const remove = (ex: Exercise) => {
    if (!window.confirm(`Eliminare "${ex.name}"?`)) return
    run(() => supabase.from('exercises').delete().eq('id', ex.id))
  }

  return (
    <>
      <h1>Catalogo esercizi</h1>

      <section className="card stack">
        <h2>Nuovo esercizio</h2>
        <ExerciseForm submitLabel="Aggiungi" onSubmit={create} resetOnSuccess />
      </section>

      {actionError && <p className="error">{actionError}</p>}
      {loading && <p className="muted">Caricamento…</p>}
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="muted">Nessun esercizio nel catalogo.</p>}

      {data && data.length > 0 && (
        <ul className="list">
          {data.map((ex) =>
            editingId === ex.id ? (
              <li key={ex.id} className="card">
                <ExerciseForm
                  initial={ex}
                  submitLabel="Salva"
                  onSubmit={(v) => update(ex.id, v)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={ex.id} className="list-item">
                <div>
                  <div>{ex.name}</div>
                  <div className="muted small">
                    {ex.muscle_group || '—'}
                    {ex.video_url && (
                      <>
                        {' · '}
                        <a href={ex.video_url} target="_blank" rel="noreferrer">
                          video
                        </a>
                      </>
                    )}
                    {ex.notes && <> · {ex.notes}</>}
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(ex.id)}>
                    Modifica
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(ex)}>
                    Elimina
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </>
  )
}

interface FormProps {
  initial?: Partial<ExerciseInput>
  submitLabel: string
  onSubmit: (values: ExerciseInput) => Promise<boolean>
  onCancel?: () => void
  resetOnSuccess?: boolean
}

function ExerciseForm({ initial, submitLabel, onSubmit, onCancel, resetOnSuccess }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [muscle, setMuscle] = useState(initial?.muscle_group ?? '')
  const [video, setVideo] = useState(initial?.video_url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onSubmit({
      name: name.trim(),
      muscle_group: muscle.trim() || null,
      video_url: video.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (ok && resetOnSuccess) {
      setName('')
      setMuscle('')
      setVideo('')
      setNotes('')
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Nome *
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Gruppo muscolare
        <input value={muscle} onChange={(e) => setMuscle(e.target.value)} placeholder="es. Petto" />
      </label>
      <label>
        URL video
        <input type="url" value={video} onChange={(e) => setVideo(e.target.value)} />
      </label>
      <label>
        Note
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row form-actions">
        <button className="btn" disabled={saving}>
          {saving ? 'Salvataggio…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Annulla
          </button>
        )}
      </div>
    </form>
  )
}
