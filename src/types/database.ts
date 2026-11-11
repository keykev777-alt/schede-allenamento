// Tipi delle tabelle Supabase, ricostruiti dalle colonne esposte via API.
// Se modifichi lo schema puoi rigenerarli con:
//   npx supabase gen types typescript --project-id vzhkyydotqcrnurvvdzi

export type Role = 'trainer' | 'client'

export interface Profile {
  id: string // = auth.users.id
  created_at: string
  role: Role
  full_name: string | null
  avatar_url: string | null
}

export interface Exercise {
  id: string
  created_at: string
  trainer_id: string
  name: string
  muscle_group: string | null
  video_url: string | null
  notes: string | null
}

export interface Program {
  id: string
  created_at: string
  trainer_id: string
  client_id: string
  name: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
}

export interface ProgramDay {
  id: string
  program_id: string
  label: string
  sort_order: number
}

export interface ProgramExercise {
  id: string
  program_day_id: string
  exercise_id: string
  sets: number | null
  reps: string | null
  load: string | null
  rest_seconds: number | null
  notes: string | null
  rpe: number | null // 1-10, opzionale
  sort_order: number
}

export interface WorkoutLog {
  id: string
  client_id: string
  program_exercise_id: string
  completed_at: string
}
