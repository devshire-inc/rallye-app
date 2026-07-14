import { useNavigate } from 'react-router-dom'
import { getVisitorSession } from '../../lib/visitorSession'
import './TemporarySessionBanner.css'

export type TemporarySessionBannerProps = {
  /**
   * Torneio da tela atual. Quando informado, o banner só aparece se bater
   * com o torneio da sessão temporária ativa — sem isso, uma sessão
   * temporária escopada ao torneio A vazaria visualmente o banner ao
   * visitante navegando (sem sessão) para o torneio B, mesmo a sessão
   * nunca tendo acesso real fora do seu escopo (isso já é garantido no
   * back-end por session.RequireScope; este check é só para a UI não
   * confundir o usuário mostrando "Acesso temporário" fora de contexto).
   */
  tournamentId?: string
}

/**
 * Banner "Acesso temporário · Criar conta completa?" (BEAC-1822) — deve
 * ficar visível durante TODA a sessão temporária de visitante (A5), não só
 * na tela de verificação. Renderiza null se não houver sessão temporária
 * ativa (ex.: usuário chegou pelo caminho "Apenas visualizar", sem login).
 * Tocar navega para o cadastro completo (A2), preservando o e-mail.
 */
export function TemporarySessionBanner({ tournamentId }: TemporarySessionBannerProps = {}) {
  const navigate = useNavigate()
  const visitorSession = getVisitorSession()

  if (!visitorSession) return null
  if (tournamentId && visitorSession.tournamentId !== tournamentId) return null

  function handleClick() {
    if (!visitorSession) return
    navigate(`/signup?email=${encodeURIComponent(visitorSession.email)}`)
  }

  return (
    <div className="temporary-session-banner" role="banner">
      <span>Acesso temporário</span>
      <button type="button" className="temporary-session-banner__button" onClick={handleClick}>
        Criar conta completa?
      </button>
    </div>
  )
}
