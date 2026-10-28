import { supabase } from './supabase'
import type { WorkoutLog } from '../types/database'

// Inizio della giornata odierna nel fuso orario del dispositivo, in ISO (UTC).
export function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Log di oggi del cliente per gli esercizi indicati, dal più recente.
export async function fetchTodayLogs(clientId: string, programExerciseIds: string[]) {
  if (programExerciseIds.length === 0) return [] as WorkoutLog[]
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('client_id', clientId)
    .in('program_exercise_id', programExerciseIds)
    .gte('completed_at', startOfTodayISO())
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data as WorkoutLog[]
}

export function logCompletion(clientId: string, programExerciseId: string) {
  return supabase.from('workout_logs').insert({
    client_id: clientId,
    program_exercise_id: programExerciseId,
    completed_at: new Date().toISOString(),
  })
}
