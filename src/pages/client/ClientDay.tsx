import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errorMessage, must, useAsync } from '../../lib/useAsync'
import { fetchTodayLogs, logCompletion } from '../../lib/workoutLogs'
import { useAuth } from '../../auth/useAuth'
import type { Exercise, ProgramDay, ProgramExercise, WorkoutLog } from '../../types/database'

export default function ClientDay() {
  const { dayId } = useParams<{ dayId: string }>()
  const { session } = useAuth()
  const clientId = session!.user.id

  const { data, error, loading, reload } = useAsync(async () => {
    const day = must(
      await supabase.from('program_days').select('*').eq('id', dayId!).maybeSingle(),
    ) as ProgramDay | null
    if (!day) return null

    const items = must(
      await supabase
        .from('program_exercises')
        .select('*')
        .eq('program_day_id', day.id)
        .order('sort_order'),
    ) as ProgramExercise[]

    const exerciseIds = [...new Set(items.map((it) => it.exercise_id))]
    const [exercises, logs] = await Promise.all([
      exerciseIds.length === 0
        ? Promise.resolve([] as Exercise[])
        : supabase
            .from('exercises')
            .select('*')
            .in('id', exerciseIds)
            .then((r) => must(r) as Exercise[]),
      fetchTodayLogs(
        clientId,
        items.map((it) => it.id),
      ),
    ])

    return { day, items, exercises: new Map(exercises.map((e) => [e.id, e])), logs }
  }, [dayId, clientId])

  // id dell'esercizio in fase di salvataggio, per disabilitare il bottone
  const [pending, setPending] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // id dell'esercizio il cui RPE è in fase di salvataggio
  const [rpePending, setRpePending] = useState<string | null>(null)

  if (loading) return <p className="muted">Caricamento…</p>
  if (error) return <p className="error">{error}</p>
  if (!data) {
    return (
      <>
        <BackLink />
        <p className="error">Giorno non trovato.</p>
      </>
    )
  }

  // Log più recente di oggi per ogni esercizio (fetchTodayLogs è ordinato dal più recente)
  const latestLog = new Map<string, WorkoutLog>()
  for (const log of data.logs) {
    if (!latestLog.has(log.program_exercise_id)) latestLog.set(log.program_exercise_id, log)
  }
  const doneCount = data.items.filter((it) => latestLog.has(it.id)).length

  const toggle = async (it: ProgramExercise) => {
    setPending(it.id)
    setActionError(null)
    const log = latestLog.get(it.id)
    const { error } = log
      ? await supabase.from('workout_logs').delete().eq('id', log.id)
      : await logCompletion(clientId, it.id)
    if (error) setActionError(errorMessage(error))
    else reload()
    setPending(null)
  }

  // Toccare il valore già selezionato lo azzera
  const setRpe = async (it: ProgramExercise, value: number) => {
    setRpePending(it.id)
    setActionError(null)
    const { data: rows, error } = await supabase
      .from('program_exercises')
      .update({ rpe: it.rpe === value ? null : value })
      .eq('id', it.id)
      .select('id')
    if (error) setActionError(errorMessage(error))
    // Con RLS un update non permesso non dà errore ma non tocca righe
    else if (!rows?.length) setActionError('Impossibile salvare l’RPE.')
    else reload()
    setRpePending(null)
  }

  return (
    <>
      <BackLink />
      <h1 className="program-title">{data.day.label}</h1>
      {data.items.length > 0 && (
        <div className="progress" aria-label={`${doneCount} di ${data.items.length} completati`}>
          <div
            className="progress-bar"
            style={{ width: `${(doneCount / data.items.length) * 100}%` }}
          />
          <span className="progress-text">
            {doneCount}/{data.items.length} completati oggi
          </span>
        </div>
      )}

      {actionError && <p className="error">{actionError}</p>}
      {data.items.length === 0 && <p className="muted">Nessun esercizio in questo giorno.</p>}

      <ol className="exercise-list">
        {data.items.map((it, i) => {
          const ex = data.exercises.get(it.exercise_id)
          const done = latestLog.has(it.id)
          return (
            <li key={it.id} className={`exercise-card${done ? ' is-done' : ''}`}>
              <div className="exercise-body">
                <div className="exercise-index">{i + 1}</div>
                <div className="exercise-info">
                  <h2 className="exercise-name">{ex?.name ?? 'Esercizio'}</h2>
                  {ex?.muscle_group && <p className="muted small">{ex.muscle_group}</p>}
                  <dl className="stats">
                    {it.sets != null && <Stat label="Serie" value={it.sets} />}
                    {it.reps && <Stat label="Ripetizioni" value={it.reps} />}
                    {it.load && <Stat label="Carico" value={it.load} />}
                    {it.rest_seconds != null && <Stat label="Recupero" value={formatRest(it.rest_seconds)} />}
                  </dl>
                  {it.notes && <p className="exercise-notes">{it.notes}</p>}
                  {ex?.video_url && (
                    <a href={ex.video_url} target="_blank" rel="noreferrer" className="small">
                      ▶ Guarda il video
                    </a>
                  )}
                </div>
              </div>
              <RpePicker
                value={it.rpe}
                disabled={rpePending === it.id}
                onSelect={(v) => setRpe(it, v)}
              />
              <button
                type="button"
                className={`check-btn${done ? ' is-done' : ''}`}
                aria-pressed={done}
                disabled={pending === it.id}
                onClick={() => toggle(it)}
              >
                {pending === it.id ? '…' : done ? '✓ Completato' : 'Segna come fatto'}
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}

function BackLink() {
  return (
    <Link to="/app" className="back-link">
      ‹ Programma
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function RpePicker({
  value,
  disabled,
  onSelect,
}: {
  value: number | null
  disabled: boolean
  onSelect: (value: number) => void
}) {
  return (
    <fieldset className="rpe" disabled={disabled}>
      <legend className="rpe-label">
        RPE <span className="rpe-value">{value ?? '—'}</span>
      </legend>
      <div className="rpe-grid">
        {RPE_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            className={`rpe-btn${value === v ? ' is-selected' : ''}`}
            aria-pressed={value === v}
            aria-label={`RPE ${v}`}
            onClick={() => onSelect(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}′${String(s).padStart(2, '0')}″` : `${m}′`
}
