import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, homeForRole } from '../auth/useAuth'
import FullScreenMessage from '../components/FullScreenMessage'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  email_not_confirmed: "L'email non è ancora stata confermata.",
}

export default function Login() {
  const { session, profile, loading, profileError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Utente già loggato (o login appena riuscito): redirect in base al ruolo
  if (session && profile) return <Navigate to={homeForRole(profile.role)} replace />
  if (session && profileError) return <FullScreenMessage error={profileError} showLogout />
  if (session && loading) return <FullScreenMessage>Accesso in corso…</FullScreenMessage>

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (error) setError(ERROR_MESSAGES[error.code ?? ''] ?? error.message)
    // In caso di successo AuthProvider riceve la sessione, carica il profilo
    // e il render successivo esegue il redirect qui sopra.
  }

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Accedi</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}
