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
