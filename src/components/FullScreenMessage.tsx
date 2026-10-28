import type { ReactNode } from 'react'
import LogoutButton from './LogoutButton'

interface Props {
  children?: ReactNode
  error?: string | null
  showLogout?: boolean
}

export default function FullScreenMessage({ children, error, showLogout }: Props) {
  return (
    <div className="center-screen">
      {children && <p className="muted">{children}</p>}
      {error && <p className="error">{error}</p>}
      {showLogout && <LogoutButton />}
    </div>
  )
}
