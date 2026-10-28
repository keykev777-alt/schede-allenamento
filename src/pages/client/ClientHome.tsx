import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { must, useAsync } from '../../lib/useAsync'
import { fetchTodayLogs } from '../../lib/workoutLogs'
import { formatDate } from '../../lib/programs'
import { useAuth } from '../../auth/useAuth'
import type { Program, ProgramDay, ProgramExercise } from '../../types/database'

export default function ClientHome() {
  const { session, profile } = useAuth()
  const clientId = session!.user.id

  const { data, error, loading } = useAsync(async () => {
    const program = must(
      await supabase
        .from('programs')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as Program | null
    if (!program) return null

    const days = must(
      await supabase.from('program_days').select('*').eq('program_id', program.id).order('sort_order'),
    ) as ProgramDay[]
    const items =
      days.length === 0
        ? []
        : (must(
            await supabase
              .from('program_exercises')
              .select('id, program_day_id')
              .in(
                'program_day_id',
                days.map((d) => d.id),
              ),
          ) as Pick<ProgramExercise, 'id' | 'program_day_id'>[])
    const logs = await fetchTodayLogs(
      clientId,
      items.map((it) => it.id),
    )
    const doneToday = new Set(logs.map((l) => l.program_exercise_id))

    return {
      program,
      days: days.map((d) => {
        const ids = items.filter((it) => it.program_day_id === d.id).map((it) => it.id)
        return { ...d, total: ids.length, done: ids.filter((id) => doneToday.has(id)).length }
      }),
    }
  }, [clientId])

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <>
      <p className="muted greeting">Ciao{firstName ? ` ${firstName}` : ''} 👋</p>

      {loading && <p className="muted">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && !data && (
        <div className="empty-state">
          <p className="empty-title">Nessun programma assegnato al momento</p>
          <p className="muted">Quando il tuo trainer ti assegnerà una scheda, la troverai qui.</p>
        </div>
      )}

      {data && (
        <>
          <h1 className="program-title">{data.program.name}</h1>
          {(data.program.start_date || data.program.end_date) && (
            <p className="muted small">
              {formatDate(data.program.start_date) ?? '…'} → {formatDate(data.program.end_date) ?? '…'}
            </p>
          )}

          {data.days.length === 0 && (
            <p className="muted">Il programma non ha ancora giorni di allenamento.</p>
          )}

          <ul className="day-list">
            {data.days.map((d) => {
              const complete = d.total > 0 && d.done === d.total
              return (
                <li key={d.id}>
                  <Link to={`/app/giorni/${d.id}`} className={`day-card${complete ? ' is-done' : ''}`}>
                    <span className="day-card-label">{d.label}</span>
                    <span className="day-card-meta">
                      {d.total === 0
                        ? 'nessun esercizio'
                        : d.done > 0
                          ? `${d.done}/${d.total} oggi`
                          : `${d.total} esercizi`}
                    </span>
                    <span className="chevron" aria-hidden>
                      {complete ? '✓' : '›'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
