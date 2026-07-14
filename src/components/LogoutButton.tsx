import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/httpClient'
import { clearTokens } from '../lib/secureStorage'

/**
 * Botão de logout (BEAC-1794): chama POST /auth/logout e, independente do
 * resultado dessa chamada, limpa o secure storage (mobile) e redireciona
 * para o login.
 *
 * Nota: este repositório ainda não tem um cache de dados client-side (ex.:
 * React Query) para limpar — só há o secure storage. Se/quando um cache
 * global for introduzido, ele deve ser invalidado aqui também.
 */
export default function LogoutButton() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      await clearTokens()
      navigate('/login', { replace: true })
    }
  }

  return (
    <button type="button" onClick={handleLogout}>
      Sair
    </button>
  )
}
