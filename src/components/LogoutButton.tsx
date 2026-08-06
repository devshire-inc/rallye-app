import { useNavigate } from 'react-router-dom'
import { Button } from './ui/Button/Button'
import { logout } from '../lib/httpClient'
import { clearTokens } from '../lib/secureStorage'
import { clearSelectedUnitId } from '../lib/tenantContext'

/**
 * Botão de logout (BEAC-1794): chama POST /auth/logout e, independente do
 * resultado dessa chamada, limpa o secure storage (mobile) e redireciona
 * para o login.
 *
 * Nota: este repositório ainda não tem um cache de dados client-side (ex.:
 * React Query) para limpar — só há o secure storage. Se/quando um cache
 * global for introduzido, ele deve ser invalidado aqui também.
 *
 * Markup no `Button` do design system (variant secondary, Figma node
 * 36:1154/289:6194) desde o reskin de ProfilePage — mesma lógica, só troca
 * o `<button>` cru.
 */
export default function LogoutButton() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      await clearTokens()
      // A arena escolhida é da SESSÃO, não da aba: mantida, ela iria no
      // header `X-Rallye-Unit` da próxima sessão desta aba — e uma unit que
      // não é membership de quem logar depois recebe 403 do backend (ver
      // ACTIVE_UNIT_HEADER em ../lib/httpClient.ts).
      clearSelectedUnitId()
      navigate('/login', { replace: true })
    }
  }

  return (
    <Button type="button" variant="secondary" fullWidth onClick={handleLogout}>
      Sair
    </Button>
  )
}
