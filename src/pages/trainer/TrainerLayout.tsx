import { NavLink, Outlet } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'

export default function TrainerLayout() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong>Schede Allenamento</strong>
          <nav className="row">
            <NavLink to="/trainer" end>
              Clienti
            </NavLink>
            <NavLink to="/trainer/esercizi">Esercizi</NavLink>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
