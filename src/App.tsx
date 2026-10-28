import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Login from './pages/Login'
import FullScreenMessage from './components/FullScreenMessage'

// Area trainer e area cliente in chunk separati: il telefono del cliente non scarica la dashboard
const TrainerLayout = lazy(() => import('./pages/trainer/TrainerLayout'))
const ClientsList = lazy(() => import('./pages/trainer/ClientsList'))
const ClientDetail = lazy(() => import('./pages/trainer/ClientDetail'))
const Exercises = lazy(() => import('./pages/trainer/Exercises'))
const ProgramEditor = lazy(() => import('./pages/trainer/ProgramEditor'))
const ClientLayout = lazy(() => import('./pages/client/ClientLayout'))
const ClientHome = lazy(() => import('./pages/client/ClientHome'))
const ClientDay = lazy(() => import('./pages/client/ClientDay'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<FullScreenMessage>Caricamento…</FullScreenMessage>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/trainer"
              element={
                <ProtectedRoute role="trainer">
                  <TrainerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientsList />} />
              <Route path="esercizi" element={<Exercises />} />
              <Route path="clienti/:clientId" element={<ClientDetail />} />
              <Route path="programmi/:programId" element={<ProgramEditor />} />
              <Route path="*" element={<Navigate to="/trainer" replace />} />
            </Route>
            <Route
              path="/app"
              element={
                <ProtectedRoute role="client">
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientHome />} />
              <Route path="giorni/:dayId" element={<ClientDay />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>
            {/* /login reindirizza già all'area giusta se l'utente è loggato */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
