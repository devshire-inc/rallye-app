import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
// GAP DE BACKEND — ver bloco de comentário abaixo: createBooking NÃO é
// chamado de verdade nesta tela ainda, mas o import fica comentado junto do
// código morto para deixar claro o que falta plugar quando o backend
// suportar self-service (ver AgendarEscolherHorarioPage.tsx para o
// levantamento completo).
// import { createBooking } from '../../lib/api/bookings'
import {
  AGENDAR_MOCK_COURT_NAME,
  AGENDAR_MOCK_TEACHER_NAME,
  agendarClassTitle,
  formatPriceCents,
  type AgendarResult,
  type AgendarSelection,
} from './agendarMockData'
import './AgendarFlow.css'

/**
 * Tela 2/3 do fluxo self-service "Agendar aula" (Aluno) — Figma "07 · Agendar
 * — Confirmar — Aluno — Mobile" (node 159:1618) / "— Desktop" (node
 * 183:2973). Recebe a seleção feita no passo 1 via router `state` (mesmo
 * padrão de AG5BookingDetailPage.tsx recebendo `booking` via
 * location.state) — abrir esta rota direto (deep link/refresh) sem esse
 * state não tem como montar o resumo, então mostra um aviso e um link de
 * volta em vez de quebrar (mesmo tratamento de AG5).
 *
 * NÃO CHAMA createBooking DE VERDADE — decisão explícita, não esquecimento:
 * ver o comentário de pacote de AgendarEscolherHorarioPage.tsx para o
 * levantamento completo. Resumo: (1) não existe endpoint de disponibilidade
 * de quadra consumível por este fluxo — o preço/vagas mostrados aqui vêm do
 * mock do passo anterior, não de um cálculo real de servidor; (2) o role
 * Aluno não tem a permission `agenda:write` que `POST /units/{id}/bookings`
 * exige (ver ../../lib/api/permissions.ts e o comentário equivalente em
 * AG5BookingDetailPage.tsx) — chamar o endpoint real aqui daria 403 sempre,
 * então simular uma chamada real seria pior que deixar o gap explícito. O
 * botão "Confirmar e pagar com PIX" abaixo só SIMULA uma confirmação
 * (delay + navegação pro passo 3) — nenhuma reserva é persistida.
 *
 * Chamada real comentada, pronta para religar assim que o backend suportar
 * self-service (endpoint de disponibilidade + permission de Aluno em
 * bookings:write, ou um endpoint dedicado de self-booking):
 *
 * ```ts
 * const result = await createBooking(selection.unitId, {
 *   type: 'private', // ou um novo BookingType dedicado a self-service
 *   courtId: /* precisa de um courtId real, hoje só temos o nome mockado * /,
 *   startAt: combineDateAndTime(selection.date.iso, selection.slot.time),
 *   endAt: combineDateAndTime(selection.date.iso, selection.slot.endTime),
 * })
 * if (!result.ok) { setError(...); return }
 * ```
 */
export default function AgendarConfirmarPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const selection = (location.state as { selection?: AgendarSelection } | null)?.selection

  const [submitting, setSubmitting] = useState(false)

  if (!unitId) return null

  if (!selection) {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <div className="agendar-body">
          <Link className="agendar-back" to={`/units/${unitId}/agenda/agendar`}>
            ‹ Voltar
          </Link>
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              Não foi possível carregar sua seleção fora do fluxo de agendamento — volte e escolha o horário
              novamente.
            </AlertCard>
          </div>
        </div>
      </AppShell>
    )
  }

  function handleConfirm() {
    if (!selection) return
    setSubmitting(true)
    // Simulação client-side (ver comentário de módulo) — sem chamada real de
    // API. O timeout só existe para dar feedback visual de "processando"
    // condizente com o botão de loading do DS.
    setTimeout(() => {
      const result: AgendarResult = { ...selection, confirmedAt: new Date().toISOString() }
      navigate(`/units/${unitId}/agenda/agendar/sucesso`, { state: { result } })
    }, 600)
  }

  const classTitle = agendarClassTitle(selection.sportLabel)
  const total = formatPriceCents(selection.slot.priceValue)

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="agendar-body">
        <Link className="agendar-back" to={`/units/${unitId}/agenda/agendar`}>
          ‹ Voltar
        </Link>

        <div className="agendar-header">
          <h1>Confirmar agendamento</h1>
          <p>Revise os detalhes antes de confirmar.</p>
        </div>

        <div className="agendar-summary-card">
          <Card>
            <div>
              <p className="agendar-summary-title">{classTitle}</p>
              <p className="agendar-summary-subtitle">
                Aula em turma · {selection.date.weekdayShort}, {selection.date.day} {selection.date.monthShort} ·{' '}
                {selection.slot.time} – {selection.slot.endTime}
              </p>
            </div>
            <div className="agendar-summary-row">
              <span>Quadra</span>
              <span>{AGENDAR_MOCK_COURT_NAME}</span>
            </div>
            <div className="agendar-summary-row">
              <span>Professor</span>
              <span>{AGENDAR_MOCK_TEACHER_NAME}</span>
            </div>
            <div className="agendar-summary-row">
              <span>Vagas</span>
              <span>
                {selection.slot.spotsTaken} de {selection.slot.spotsTotal} vagas
              </span>
            </div>
            <div className="agendar-summary-row">
              <span>Arena</span>
              <span>{selection.unitName}</span>
            </div>
            <hr className="agendar-summary-divider" />
            <div className="agendar-summary-row agendar-summary-total">
              <span>Total a pagar</span>
              <span>{total}</span>
            </div>
          </Card>
        </div>

        <AlertCard tone="warning">
          <strong>Cancele até 24h antes e ganhe 1 crédito</strong>
          <p>Com menos de 24h, o cancelamento não gera crédito. O pagamento é feito por PIX na confirmação.</p>
        </AlertCard>

        <div className="agendar-confirm-actions">
          <Button variant="ghost" size="lg" onClick={() => navigate(`/units/${unitId}/agenda/agendar`)}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" fullWidth loading={submitting} onClick={handleConfirm}>
            Confirmar e pagar com PIX
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
