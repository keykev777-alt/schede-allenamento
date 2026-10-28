import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function LogoutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleClick = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={handleClick}>
      Esci
    </button>
  )
}
