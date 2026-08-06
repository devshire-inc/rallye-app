import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { bookClassOccurrence } from '../../lib/api/classOccurrences'
import { formatPriceCents, type AgendarResult, type AgendarSelection } from './agendarMockData'
import './AgendarFlow.css'

function formatDateTime(iso: string): { weekdayShort: string; day: number; monthShort: string; time: string } {
  const d = new Date(iso)
  return {
    weekdayShort: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    day: d.getDate(),
    monthShort: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

/** Mensagens de erro específicas para os códigos documentados de
 * POST .../occurrences/book — fallback genérico para qualquer outro. */
function bookingErrorMessage(error: string): string {
  switch (error) {
    case 'occurrence_full':
      return 'Essa turma acabou de lotar — escolha outro horário.'
    case 'already_booked':
      return 'Você já tem uma reserva nesta ocorrência.'
    case 'class_not_found':
      return 'Essa turma não existe mais — volte e escolha outro horário.'
    case 'class_inactive':
      return 'Essa turma foi desativada — volte e escolha outro horário.'
    case 'invalid_occurrence':
      return 'Esse horário não é mais válido — volte e escolha outro.'
    default:
      return 'Não foi possível confirmar seu agendamento agora. Tente novamente.'
  }
}

/**
 * Tela 2/3 do fluxo self-service "Agendar aula" (Aluno) — Figma "07 · Agendar
 * — Confirmar — Aluno — Mobile" (node 159:1618) / "— Desktop" (node
 * 183:2973). Recebe a seleção feita no passo 1 via router `state` (mesmo
 * padrão de AG5BookingDetailPage.tsx recebendo `booking` via
 * location.state) — abrir esta rota direto (deep link/refresh) sem esse
 * state não tem como montar o resumo, então mostra um aviso e um link de
 * volta em vez de quebrar (mesmo tratamento de AG5).
 *
 * Chama POST /units/{id}/classes/{classId}/occurrences/book de verdade
 * (../../lib/api/classOccurrences.ts) ao confirmar — os erros documentados
 * do endpoint (409 occurrence_full/already_booked, 404 class_not_found, 409
 * class_inactive, 400 invalid_occurrence/invalid_body) viram uma mensagem
 * amigável no AlertCard já usado nesta tela (ver bookingErrorMessage acima).
 * Não há gateway PIX real: a confirmação já acontece nesta chamada, sem
 * pagamento — o texto "Confirmar e pagar com PIX" é só a copy do Figma.
 */
export default function AgendarConfirmarPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const selection = (location.state as { selection?: AgendarSelection } | null)?.selection

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!unitId) return null

  if (!selection) {
    return (
      <>
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
      </>
    )
  }

  async function handleConfirm() {
    if (!selection || !unitId) return
    setSubmitting(true)
    setError(null)
    const response = await bookClassOccurrence(unitId, selection.occurrence.classId, selection.occurrence.startAt)
    setSubmitting(false)
    if (!response.ok) {
      setError(bookingErrorMessage(response.error))
      return
    }
    const result: AgendarResult = { ...selection, bookingId: response.bookingId, confirmedAt: response.addedAt }
    navigate(`/units/${unitId}/agenda/agendar/sucesso`, { state: { result } })
  }

  const { weekdayShort, day, monthShort, time } = formatDateTime(selection.occurrence.startAt)
  const endTime = new Date(selection.occurrence.endAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const total = formatPriceCents(selection.occurrence.priceCents as number)

  return (
    <>
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
              <p className="agendar-summary-title">{selection.occurrence.className}</p>
              <p className="agendar-summary-subtitle">
                Aula em turma · {weekdayShort}, {day} {monthShort} · {time} – {endTime}
              </p>
            </div>
            <div className="agendar-summary-row">
              <span>Quadra</span>
              <span>{selection.courtName}</span>
            </div>
            <div className="agendar-summary-row">
              <span>Professor</span>
              <span>{selection.teacherName}</span>
            </div>
            <div className="agendar-summary-row">
              <span>Vagas</span>
              <span>
                {selection.occurrence.availableSeats} de {selection.occurrence.capacity} vagas
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

        {error ? (
          <div role="alert">
            <AlertCard tone="danger" showIcon>
              {error}
            </AlertCard>
          </div>
        ) : null}

        <div className="agendar-confirm-actions">
          <Button variant="ghost" size="lg" onClick={() => navigate(`/units/${unitId}/agenda/agendar`)}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" fullWidth loading={submitting} onClick={handleConfirm}>
            Confirmar e pagar com PIX
          </Button>
        </div>
      </div>
    </>
  )
}
