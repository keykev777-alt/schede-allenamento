import { Outlet } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'

export default function ClientLayout() {
  return (
    <div className="app-shell">
      <header className="app-bar">
        <span className="app-bar-title">Allenamento</span>
        <LogoutButton />
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
