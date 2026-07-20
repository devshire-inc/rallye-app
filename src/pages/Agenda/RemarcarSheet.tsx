import { useCallback, useEffect, useState } from 'react'
import { listBookingParticipants, getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { listClasses } from '../../lib/api/classes'
import {
  createReschedule,
  getRescheduleConfig,
  listRescheduleCredits,
  type RescheduleCredit,
  type RescheduleStatus,
} from '../../lib/api/reschedule'
import './RemarcarSheet.css'

export interface RemarcarResult {
  status: RescheduleStatus
}

export interface RemarcarSheetProps {
  unitId: string
  studentId: string
  /** Chamado depois que a remarcação foi de fato aplicada OU enviada para
   * aprovação (status distingue os 2 casos) — mesmo espírito de
   * AddStudentSheet.onAdded: quem usa este sheet decide se/como fecha e
   * mostra uma mensagem de sucesso na página (ver AG5BookingDetailPage.tsx,
   * handleStudentAdded). */
  onRescheduled: (result: RemarcarResult) => void
  onCancel: () => void
}

interface SlotOption {
  booking: Booking
  vagas: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'no-credits' }
  | { status: 'ready'; credit: RescheduleCredit; creditCount: number; slots: SlotOption[]; requiresApproval: boolean }

/** Janela de busca de slots candidatos (dias a partir de agora) — o AC não
 * define um valor exato ("lista de slots disponíveis"), 14 dias é o mesmo
 * horizonte já usado por AG3StudentAgendaPage.tsx para "Próximas". */
const SLOT_WINDOW_DAYS = 14

const ERROR_MESSAGES: Record<string, string> = {
  credit_expired: 'Este crédito expirou.',
  credit_already_used: 'Este crédito já foi usado.',
  already_participant_at_target: 'Você já está participando desta ocorrência.',
  target_booking_not_found: 'Esta ocorrência não está mais disponível.',
  credit_not_found: 'Crédito não encontrado.',
}

/**
 * AG7 — bottom sheet "Remarcar" (BEAC-1912, story BEAC-1705 — "Geração de
 * crédito ao cancelar aula"). Protótipo real: `#sheet-ag7` (artifact
 * referenciado no handover desta task).
 *
 * # Toast com contagem REAL (não a cópia hardcoded do protótipo)
 *
 * O protótipo mostra a string fixa "1 crédito de reagendamento disponível
 * este mês" — por decisão já travada em BEAC-1915 (reaplicada aqui, per o
 * handover desta task), este sheet busca a contagem REAL via GET
 * /students/{id}/reschedule-credits (gap de leitura coberto por esta mesma
 * dispatch, ver ../../lib/api/reschedule.ts) em vez de exibir o texto fixo.
 *
 * # Só o crédito mais próximo de expirar é oferecido
 *
 * Quando o aluno tem MAIS de 1 crédito disponível, este sheet só oferece o
 * de expires_at mais próximo (o backend já devolve ordenado por expires_at
 * ASC) — decisão desta task para não precisar de um seletor de "qual
 * crédito usar" (o AC não pede isso, e usar o que vai expirar primeiro é o
 * comportamento mais seguro pro aluno). Usar o sheet de novo depois consome
 * o próximo.
 *
 * # "Vagas" — composição client-side, sem inventar dado
 *
 * GET /units/{id}/bookings (grid) NÃO devolve capacidade/participantes por
 * ocorrência — só o suficiente pro grid visual. Para "vagas" real (AC pede
 * "data, quadra, vagas"), este sheet busca as turmas da unit (listClasses,
 * capacity por class_id) e, para cada ocorrência candidata dentro da janela
 * de {@link SLOT_WINDOW_DAYS} dias, conta os participantes já registrados
 * (listBookingParticipants) — vagas = capacity - participantes. Slots sem
 * vaga (vagas <= 0) são filtrados fora da lista.
 *
 * # GAP CONHECIDO — sem filtro por "mesmo esporte/turma da aula cancelada"
 *
 * O handover desta task sugere filtrar a lista de destino "do mesmo esporte/
 * turma" da aula que gerou o crédito — mas não existe (nem foi pedido em
 * nenhuma story anterior) um GET /bookings/{id} de leitura por id único (ver
 * gap já documentado em AG5BookingDetailPage.tsx), então este sheet não tem
 * como buscar os detalhes da aula de ORIGEM do crédito (reschedule_credits
 * só devolve source_booking_id, um uuid) para saber seu esporte/turma e
 * filtrar a lista de destino por ele. Decisão desta task: listar TODAS as
 * ocorrências de turma com vaga na unit dentro da janela, sem filtro de
 * esporte — mais permissivo que o desenhado no protótipo, mas não inventa
 * uma chamada que o backend não suporta. Adicionar esse filtro exigiria um
 * novo endpoint de leitura (GET /bookings/{id}), fora do escopo desta task.
 */
export function RemarcarSheet({ unitId, studentId, onRescheduled, onCancel }: RemarcarSheetProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      Promise.all([listRescheduleCredits(studentId), getRescheduleConfig(unitId)])
        .then(async ([creditsResult, configResult]) => {
          if (onCancelled()) return
          if (!creditsResult.ok) {
            setState({ status: 'error' })
            return
          }
          if (creditsResult.credits.length === 0) {
            setState({ status: 'no-credits' })
            return
          }
          const requiresApproval = configResult.ok ? configResult.requiresApproval : false

          const from = new Date()
          const to = new Date()
          to.setDate(to.getDate() + SLOT_WINDOW_DAYS)
          const gridResult = await getBookingsGrid(unitId, from.toISOString(), to.toISOString())
          if (onCancelled()) return
          if (!gridResult.ok) {
            setState({ status: 'error' })
            return
          }

          const now = new Date()
          const candidates = gridResult.bookings.filter(
            (b) => b.type === 'class_occurrence' && b.status === 'confirmed' && new Date(b.startAt) > now,
          )

          const classesResult = await listClasses(unitId)
          if (onCancelled()) return
          const capacityByClassId = new Map<string, number>()
          if (classesResult.ok) {
            for (const c of classesResult.classes) capacityByClassId.set(c.id, c.capacity)
          }

          const slotsWithCapacity = await Promise.all(
            candidates.map(async (booking): Promise<SlotOption | null> => {
              const capacity = booking.classId ? capacityByClassId.get(booking.classId) : undefined
              if (capacity === undefined) return null
              const participantsResult = await listBookingParticipants(booking.id)
              if (!participantsResult.ok) return null
              const vagas = capacity - participantsResult.participants.length
              return vagas > 0 ? { booking, vagas } : null
            }),
          )
          if (onCancelled()) return

          const slots = slotsWithCapacity.filter((s): s is SlotOption => s !== null)
          setState({
            status: 'ready',
            credit: creditsResult.credits[0],
            creditCount: creditsResult.credits.length,
            slots,
            requiresApproval,
          })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, studentId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleReschedule(bookingId: string) {
    if (state.status !== 'ready' || submittingId !== null) return
    setSubmitError(null)
    setSubmittingId(bookingId)
    const result = await createReschedule(studentId, state.credit.id, bookingId)
    setSubmittingId(null)

    if (!result.ok) {
      setSubmitError(ERROR_MESSAGES[result.error] ?? 'Não foi possível remarcar agora. Tente novamente.')
      return
    }

    onRescheduled({ status: result.status })
  }

  return (
    <div className="remarcar-sheet">
      <h2 className="sec-head-title">Remarcar</h2>

      {state.status === 'loading' ? <p role="status">Carregando…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar os créditos de reagendamento agora.</p>
      ) : null}
      {state.status === 'no-credits' ? (
        <p className="hint">Nenhum crédito de reagendamento disponível este mês.</p>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <p role="status" className="toast toast-info">
            {`${state.creditCount} ${state.creditCount === 1 ? 'crédito' : 'créditos'} de reagendamento ${
              state.creditCount === 1 ? 'disponível' : 'disponíveis'
            } este mês`}
          </p>

          {state.slots.length === 0 ? (
            <p className="hint">Nenhum horário com vaga disponível nos próximos {SLOT_WINDOW_DAYS} dias.</p>
          ) : (
            <div className="remarcar-slot-list">
              {state.slots.map(({ booking, vagas }) => (
                <div className="remarcar-slot-row" key={booking.id}>
                  <div>
                    <div className="nm">{booking.className ?? 'Aula'}</div>
                    <div className="mt">
                      {new Date(booking.startAt).toLocaleString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {booking.courtName} · {vagas} vaga{vagas === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={submittingId !== null}
                    onClick={() => handleReschedule(booking.id)}
                  >
                    {submittingId === booking.id ? 'Remarcando…' : 'Remarcar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {submitError ? (
            <p role="alert" className="field-error">
              {submitError}
            </p>
          ) : null}

          <div className="foot-note">
            {state.requiresApproval
              ? 'Esta arena exige aprovação do admin — o pedido fica "aguardando" até a resposta. '
              : ''}
            O crédito expira ao fim do mês corrente (ou do mês seguinte, se a aula cancelada foi nos últimos 7
            dias do mês).
          </div>
        </>
      ) : null}

      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Fechar
      </button>
    </div>
  )
}
