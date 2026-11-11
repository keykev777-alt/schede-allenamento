import { supabase } from './supabase'

// Eliminazioni "a cascata" fatte lato client: non diamo per scontato che le foreign key
// del database abbiano ON DELETE CASCADE.

export async function deleteDays(dayIds: string[]) {
  if (dayIds.length === 0) return { error: null }
  const ex = await supabase.from('program_exercises').delete().in('program_day_id', dayIds)
  if (ex.error) return ex
  return supabase.from('program_days').delete().in('id', dayIds)
}

export async function deleteProgram(programId: string) {
  const days = await supabase.from('program_days').select('id').eq('program_id', programId)
  if (days.error) return days
  const res = await deleteDays(days.data.map((d) => d.id))
  if (res.error) return res
  return supabase.from('programs').delete().eq('id', programId)
}

// Scambia sort_order tra due righe della stessa tabella (per i bottoni su/giù).
export async function swapOrder(
  table: 'program_days' | 'program_exercises',
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
) {
  // Se i due valori coincidono (dati vecchi) usiamo le posizioni come fallback
  const [orderA, orderB] = a.sort_order === b.sort_order ? [b.sort_order + 1, a.sort_order] : [b.sort_order, a.sort_order]
  const r1 = await supabase.from(table).update({ sort_order: orderA }).eq('id', a.id)
  if (r1.error) return r1
  return supabase.from(table).update({ sort_order: orderB }).eq('id', b.id)
}

export function formatDate(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT') : null
}

// --- Duplicazione ---------------------------------------------------------------------
// Come per le eliminazioni, la copia è fatta lato client con più query. Se un passaggio
// fallisce proviamo a rimuovere quanto già creato, così non restano copie a metà.

const EXERCISE_FIELDS =
  'program_day_id, exercise_id, sets, reps, load, rest_seconds, notes, rpe, sort_order'

// Copia gli esercizi dei giorni sorgente nei giorni di destinazione (mappa vecchio id → nuovo id).
async function copyExercises(dayMap: Map<string, string>) {
  if (dayMap.size === 0) return { error: null }
  const src = await supabase
    .from('program_exercises')
    .select(EXERCISE_FIELDS)
    .in('program_day_id', [...dayMap.keys()])
  if (src.error) return src
  if (src.data.length === 0) return { error: null }
  const rows = src.data.map((r) => ({ ...r, program_day_id: dayMap.get(r.program_day_id)! }))
  return supabase.from('program_exercises').insert(rows)
}

// Duplica un giorno nello stesso programma, mettendolo in fondo (sort_order indicato).
export async function duplicateDay(
  day: { id: string; program_id: string; label: string },
  sortOrder: number,
) {
  const created = await supabase
    .from('program_days')
    .insert({ program_id: day.program_id, label: `${day.label} (copia)`, sort_order: sortOrder })
    .select('id')
    .single()
  if (created.error) return created
  const res = await copyExercises(new Map([[day.id, created.data.id]]))
  if (res.error) {
    await deleteDays([created.data.id])
    return res
  }
  return { error: null }
}

// Duplica un programma (giorni + esercizi) per il cliente indicato. Il nuovo programma
// nasce non attivo e senza date. Ritorna l'id del nuovo programma.
export async function duplicateProgram(
  source: { id: string; trainer_id: string },
  target: { clientId: string; name: string },
): Promise<{ id: string; error: null } | { id: null; error: unknown }> {
  const days = await supabase
    .from('program_days')
    .select('id, label, sort_order')
    .eq('program_id', source.id)
    .order('sort_order')
  if (days.error) return { id: null, error: days.error }

  const created = await supabase
    .from('programs')
    .insert({
      trainer_id: source.trainer_id,
      client_id: target.clientId,
      name: target.name,
      is_active: false,
      start_date: null,
      end_date: null,
    })
    .select('id')
    .single()
  if (created.error) return { id: null, error: created.error }
  const programId = created.data.id as string

  const fail = async (error: unknown) => {
    await deleteProgram(programId)
    return { id: null, error }
  }

  // Un insert per giorno: così la corrispondenza vecchio → nuovo id è certa
  const dayMap = new Map<string, string>()
  for (const d of days.data) {
    const nd = await supabase
      .from('program_days')
      .insert({ program_id: programId, label: d.label, sort_order: d.sort_order })
      .select('id')
      .single()
    if (nd.error) return fail(nd.error)
    dayMap.set(d.id, nd.data.id)
  }

  const res = await copyExercises(dayMap)
  if (res.error) return fail(res.error)
  return { id: programId, error: null }
}
