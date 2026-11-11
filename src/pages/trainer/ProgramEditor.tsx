import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errorMessage, must, useAsync } from '../../lib/useAsync'
import { useAction } from '../../lib/useAction'
import { deleteDays, deleteProgram, duplicateDay, swapOrder } from '../../lib/programs'
import { useAuth } from '../../auth/useAuth'
import type { Exercise, Profile, Program, ProgramDay, ProgramExercise } from '../../types/database'
import ProgramForm from './ProgramForm'

type ProgramExerciseInput = Pick<
  ProgramExercise,
  'exercise_id' | 'sets' | 'reps' | 'load' | 'rest_seconds' | 'notes' | 'rpe'
>

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const nextOrder = (rows: { sort_order: number }[]) =>
  rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1

export default function ProgramEditor() {
  const { programId } = useParams<{ programId: string }>()
  const { session } = useAuth()
  const trainerId = session!.user.id
  const navigate = useNavigate()

  const { data, error, loading, reload } = useAsync(async () => {
    const program = must(
      await supabase.from('programs').select('*').eq('id', programId!).maybeSingle(),
    ) as Program | null
    if (!program) return null

    const [client, days, catalog] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', program.client_id).maybeSingle(),
      supabase.from('program_days').select('*').eq('program_id', program.id).order('sort_order'),
      supabase.from('exercises').select('*').eq('trainer_id', trainerId).order('name'),
    ])
    const dayRows = must(days) as ProgramDay[]
    const items =
      dayRows.length === 0
        ? []
        : (must(
            await supabase
              .from('program_exercises')
              .select('*')
              .in(
                'program_day_id',
                dayRows.map((d) => d.id),
              )
              .order('sort_order'),
          ) as ProgramExercise[])

    return {
      program,
      client: must(client) as Profile | null,
      days: dayRows,
      items,
      catalog: must(catalog) as Exercise[],
    }
  }, [programId, trainerId])

  const { run, error: actionError } = useAction(reload)
  const [newDayLabel, setNewDayLabel] = useState('')

  if (loading) return <p className="muted">Caricamento…</p>
  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="error">Programma non trovato.</p>

  const { program, client, days, items, catalog } = data
  const catalogById = new Map(catalog.map((e) => [e.id, e]))

  const addDay = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await run(() =>
      supabase.from('program_days').insert({
        program_id: program.id,
        label: newDayLabel.trim(),
        sort_order: nextOrder(days),
      }),
    )
    if (ok) setNewDayLabel('')
  }

  const removeProgram = async () => {
    if (!window.confirm(`Eliminare il programma "${program.name}" con tutti i giorni ed esercizi?`))
      return
    const res = await deleteProgram(program.id)
    if (res.error) window.alert(errorMessage(res.error))
    else navigate(`/trainer/clienti/${program.client_id}`, { replace: true })
  }

  return (
    <>
      <Link to={`/trainer/clienti/${program.client_id}`} className="small">
        ← {client?.full_name || 'Cliente'}
      </Link>
      <div className="row space-between">
        <h1>{program.name}</h1>
        <button className="btn btn-danger btn-sm" onClick={removeProgram}>
          Elimina programma
        </button>
      </div>

      <details className="card">
        <summary>Dati del programma</summary>
        <ProgramForm
          key={`${program.name}|${program.start_date}|${program.end_date}|${program.is_active}`}
          initial={program}
          submitLabel="Salva"
          onSubmit={async (values) => {
            const res = await supabase.from('programs').update(values).eq('id', program.id)
            if (res.error) return errorMessage(res.error)
            reload()
            return null
          }}
        />
      </details>

      {actionError && <p className="error">{actionError}</p>}
      {catalog.length === 0 && (
        <p className="muted">
          Il catalogo esercizi è vuoto: <Link to="/trainer/esercizi">aggiungi qualche esercizio</Link>{' '}
          prima di comporre i giorni.
        </p>
      )}

      {days.map((day, i) => (
        <DayCard
          key={day.id}
          day={day}
          items={items.filter((it) => it.program_day_id === day.id)}
          catalog={catalog}
          catalogById={catalogById}
          run={run}
          onDuplicate={() => run(() => duplicateDay(day, nextOrder(days)))}
          onMoveUp={i > 0 ? () => run(() => swapOrder('program_days', day, days[i - 1])) : undefined}
          onMoveDown={
            i < days.length - 1
              ? () => run(() => swapOrder('program_days', day, days[i + 1]))
              : undefined
          }
        />
      ))}

      <form className="card row" onSubmit={addDay}>
        <input
          required
          value={newDayLabel}
          onChange={(e) => setNewDayLabel(e.target.value)}
          placeholder={`es. Giorno ${days.length + 1} – Push`}
          className="grow"
        />
        <button className="btn">Aggiungi giorno</button>
      </form>
    </>
  )
}

type Run = ReturnType<typeof useAction>['run']

interface DayCardProps {
  day: ProgramDay
  items: ProgramExercise[]
  catalog: Exercise[]
  catalogById: Map<string, Exercise>
  run: Run
  onDuplicate: () => Promise<boolean>
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function DayCard({
  day,
  items,
  catalog,
  catalogById,
  run,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: DayCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [label, setLabel] = useState(day.label)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const rename = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await run(() =>
      supabase.from('program_days').update({ label: label.trim() }).eq('id', day.id),
    )
    if (ok) setRenaming(false)
  }

  const duplicate = async () => {
    setDuplicating(true)
    await onDuplicate()
    setDuplicating(false)
  }

  const removeDay = () => {
    if (!window.confirm(`Eliminare "${day.label}" e i suoi ${items.length} esercizi?`)) return
    run(() => deleteDays([day.id]))
  }

  const addItem = async (values: ProgramExerciseInput) => {
    const ok = await run(() =>
      supabase
        .from('program_exercises')
        .insert({ ...values, program_day_id: day.id, sort_order: nextOrder(items) }),
    )
    if (ok) setAdding(false)
    return ok
  }

  const updateItem = async (id: string, values: ProgramExerciseInput) => {
    const ok = await run(() => supabase.from('program_exercises').update(values).eq('id', id))
    if (ok) setEditingId(null)
    return ok
  }

  const removeItem = (it: ProgramExercise) => {
    const name = catalogById.get(it.exercise_id)?.name ?? 'questo esercizio'
    if (!window.confirm(`Rimuovere ${name} da "${day.label}"?`)) return
    run(() => supabase.from('program_exercises').delete().eq('id', it.id))
  }

  return (
    <section className="card stack">
      <div className="row space-between">
        {renaming ? (
          <form className="row grow" onSubmit={rename}>
            <input
              required
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="grow"
            />
            <button className="btn btn-sm">Salva</button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setLabel(day.label)
                setRenaming(false)
              }}
            >
              Annulla
            </button>
          </form>
        ) : (
          <h2>{day.label}</h2>
        )}
        {!renaming && (
          <div className="row">
            <button className="btn btn-secondary btn-sm" disabled={!onMoveUp} onClick={onMoveUp} title="Sposta su">
              ↑
            </button>
            <button className="btn btn-secondary btn-sm" disabled={!onMoveDown} onClick={onMoveDown} title="Sposta giù">
              ↓
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setRenaming(true)}>
              Rinomina
            </button>
            <button className="btn btn-secondary btn-sm" disabled={duplicating} onClick={duplicate}>
              {duplicating ? 'Duplico…' : 'Duplica'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={removeDay}>
              Elimina
            </button>
          </div>
        )}
      </div>

      {items.length === 0 && <p className="muted small">Nessun esercizio in questo giorno.</p>}
      {items.length > 0 && (
        <ol className="list">
          {items.map((it, i) =>
            editingId === it.id ? (
              <li key={it.id} className="card">
                <ProgramExerciseForm
                  catalog={catalog}
                  initial={it}
                  submitLabel="Salva"
                  onSubmit={(v) => updateItem(it.id, v)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={it.id} className="list-item">
                <div>
                  <div>{catalogById.get(it.exercise_id)?.name ?? 'Esercizio non trovato'}</div>
                  <div className="muted small">{summary(it)}</div>
                </div>
                <div className="row">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={i === 0}
                    onClick={() => run(() => swapOrder('program_exercises', it, items[i - 1]))}
                    title="Sposta su"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={i === items.length - 1}
                    onClick={() => run(() => swapOrder('program_exercises', it, items[i + 1]))}
                    title="Sposta giù"
                  >
                    ↓
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(it.id)}>
                    Modifica
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeItem(it)}>
                    Rimuovi
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {adding ? (
        <ProgramExerciseForm
          catalog={catalog}
          submitLabel="Aggiungi"
          onSubmit={addItem}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={catalog.length === 0}
            onClick={() => setAdding(true)}
          >
            + Aggiungi esercizio
          </button>
        </div>
      )}
    </section>
  )
}

function summary(it: ProgramExercise) {
  const parts = []
  if (it.sets || it.reps) parts.push(`${it.sets ?? '?'} × ${it.reps ?? '?'}`)
  if (it.load) parts.push(it.load)
  if (it.rest_seconds) parts.push(`recupero ${it.rest_seconds}s`)
  if (it.rpe != null) parts.push(`RPE ${it.rpe}`)
  if (it.notes) parts.push(it.notes)
  return parts.join(' · ') || '—'
}

interface ProgramExerciseFormProps {
  catalog: Exercise[]
  initial?: ProgramExerciseInput
  submitLabel: string
  onSubmit: (values: ProgramExerciseInput) => Promise<boolean>
  onCancel: () => void
}

function ProgramExerciseForm({
  catalog,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ProgramExerciseFormProps) {
  const [exerciseId, setExerciseId] = useState(initial?.exercise_id ?? '')
  const [sets, setSets] = useState(initial?.sets?.toString() ?? '')
  const [reps, setReps] = useState(initial?.reps ?? '')
  const [load, setLoad] = useState(initial?.load ?? '')
  const [rest, setRest] = useState(initial?.rest_seconds?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [rpe, setRpe] = useState(initial?.rpe?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSubmit({
      exercise_id: exerciseId,
      sets: sets ? Number(sets) : null,
      reps: reps.trim() || null,
      load: load.trim() || null,
      rest_seconds: rest ? Number(rest) : null,
      notes: notes.trim() || null,
      rpe: rpe ? Number(rpe) : null,
    })
    setSaving(false)
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="span-all">
        Esercizio *
        <select required value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="">— scegli dal catalogo —</option>
          {catalog.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
              {ex.muscle_group ? ` (${ex.muscle_group})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Serie
        <input type="number" min={1} inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
      </label>
      <label>
        Ripetizioni
        <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="es. 8-10" />
      </label>
      <label>
        Carico
        <input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="es. 60 kg" />
      </label>
      <label>
        Recupero (secondi)
        <input type="number" min={0} inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
      </label>
      <label>
        RPE
        <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
          <option value="">— non impostato —</option>
          {RPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="span-all">
        Note
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row form-actions">
        <button className="btn" disabled={saving}>
          {saving ? 'Salvataggio…' : submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </form>
  )
}
