import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Icon } from '../../components/ui/Icon/Icon'
import {
  AGENDAR_MOCK_COURT_NAME,
  AGENDAR_MOCK_TEACHER_NAME,
  agendarClassTitle,
  formatPriceCents,
  type AgendarResult,
} from './agendarMockData'
import './AgendarFlow.css'

/**
 * Tela 3/3 do fluxo self-service "Agendar aula" (Aluno) — Figma "08 · Agendar
 * — Sucesso — Aluno — Mobile" (node 159:1660) / "— Desktop" (node
 * 183:2992). Badge de sucesso (círculo verde + check) no mesmo espírito
 * visual de `.unit-success*` em src/pages/Units/NewUnitPage.css ("Arena
 * Criada") — aqui como classes próprias (`.agendar-success*`) porque o Figma
 * desta tela usa um único círculo (fundo verde suave + check, sem o círculo
 * sólido interno da versão de NewUnitPage), então reaproveitar exatamente a
 * mesma marcação teria adicionado uma camada visual que o design não pede.
 *
 * Recebe o `result` do passo anterior via router `state` (mesmo padrão de
 * AgendarConfirmarPage.tsx) — como esta tela é só uma confirmação
 * informativa (nenhuma ação nela falha), a ausência do state ainda mostra a
 * tela de sucesso genérica (sem os detalhes de horário/preço) em vez de
 * bloquear com um erro — ao contrário de AgendarConfirmarPage/AG5, aqui não
 * há nada de crítico que dependa do state para funcionar.
 */
export default function AgendarSucessoPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const result = (location.state as { result?: AgendarResult } | null)?.result

  if (!unitId) return null

  const classTitle = result ? agendarClassTitle(result.sportLabel) : 'sua aula'
  const subtitle = result
    ? `Sua vaga em ${classTitle} está garantida para ${result.date.weekdayShort}, ${result.date.day} ${result.date.monthShort} às ${result.slot.time}.`
    : 'Sua vaga está garantida.'

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="agendar-success">
        <div className="agendar-success__badge" aria-hidden="true">
          <Icon name="check" size={40} />
        </div>
        <div>
          <h1 className="agendar-success__title">Aula agendada!</h1>
          <p className="agendar-success__subtitle">{subtitle}</p>
        </div>

        {result ? (
          <div className="agendar-success__summary">
            <strong>
              {AGENDAR_MOCK_COURT_NAME} · Prof. {AGENDAR_MOCK_TEACHER_NAME}
            </strong>
            <span>Pago via PIX · {formatPriceCents(result.slot.priceValue)}</span>
          </div>
        ) : (
          <AlertCard tone="info">
            Detalhes do agendamento indisponíveis (chegou nesta tela fora do fluxo) — confira sua agenda para
            ver a aula confirmada.
          </AlertCard>
        )}

        <div className="agendar-success__actions">
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate(`/units/${unitId}/agenda/minha`)}>
            Ver na minha agenda
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={() => navigate(`/units/${unitId}/dashboard`)}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
