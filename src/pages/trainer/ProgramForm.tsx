import { useState, type FormEvent } from 'react'
import type { Program } from '../../types/database'

export type ProgramInput = Pick<Program, 'name' | 'start_date' | 'end_date' | 'is_active'>

// Usato sia per creare un programma sia (in ProgramEditor) per modificarne i dati.
export default function ProgramForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ProgramInput
  submitLabel: string
  onSubmit: (values: ProgramInput) => Promise<string | null> // ritorna un messaggio d'errore o null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [start, setStart] = useState(initial?.start_date ?? '')
  const [end, setEnd] = useState(initial?.end_date ?? '')
  const [active, setActive] = useState(initial?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (start && end && end < start) {
      setError('La data di fine è precedente a quella di inizio.')
      return
    }
    setSaving(true)
    setError(null)
    const err = await onSubmit({
      name: name.trim(),
      start_date: start || null,
      end_date: end || null,
      is_active: active,
    })
    setSaving(false)
    setError(err)
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Nome *
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="es. Forza – blocco 1"
        />
      </label>
      <label>
        Data inizio
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        Data fine
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Attivo
      </label>
      {error && <p className="error form-actions">{error}</p>}
      <div className="row form-actions">
        <button className="btn" disabled={saving}>
          {saving ? 'Salvataggio…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
