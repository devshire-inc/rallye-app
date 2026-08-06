import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Toast } from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { usePermission } from '../../hooks/usePermission'
import {
  listBookingParticipants,
  submitAttendance,
  type AttendanceStatus,
  type Booking,
  type BookingParticipant,
} from '../../lib/api/bookings'
import { bookingTitle } from './agendaShared'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './CheckinPage.css'

/**
 * T3 — Check-in de Presença (BEAC-1907, story BEAC-1704 — dispatch ad-hoc de
 * encerramento). Markup/classes/copy lidos direto do protótipo real
 * (Artifact "Rallye — Pessoas & Turmas", `#scr-t3`): `.pg-head` com h1 +
 * `.count` (subtítulo) + botão "Salvar" (`.btn.btn-primary.btn-sm`),
 * `.ck-row` (`.avatar-sm` + `.nm` + `.ck-tgl` de 3 botões `.ok`/`.no`/`.ju`
 * com `aria-pressed`), botão "Marcar todos presentes" (`.btn.btn-ghost.btn-sm`)
 * e `.ck-summary`. Os glifos reais são ✓/✕/◐ (não os emoji ✅❌🔄 do texto do
 * AC do work item) — a mesma prioridade já usada por outras telas deste
 * épico (protótipo real > paráfrase do AC) quando os dois divergem, ver
 * AG5BookingDetailPage.tsx ("Cancelar aula" em vez do "[Cancelar]" shouted
 * do AC).
 *
 * Rota `/units/:unitId/bookings/:bookingId/checkin`.
 *
 * ## GAP CONHECIDO — sem GET /bookings/{id}: mesmo padrão de AG5
 *
 * Não existe endpoint de leitura de UM booking — só grid e agora
 * POST/PATCH/GET participants. Por isso esta página também espera
 * `location.state.booking` (o AG5BookingDetailPage/TurmaDetailPage já
 * carregado o objeto de onde navegam pra cá) — abrir esta rota direto (deep
 * link/refresh) sem esse state não tem como montar o cabeçalho; mostra um
 * aviso em vez de quebrar.
 *
 * ## GET /bookings/{id}/participants — endpoint NOVO desta dispatch
 *
 * Não existia (em nenhuma story/task já dispachada) um caminho de LEITURA da
 * lista de `booking_participants` de um booking — só escrita. Esta tela não
 * tem como existir sem a lista real de alunos, então o endpoint mínimo (GET,
 * mesmo padrão de autorização dos outros endpoints de /bookings/{id}/*) foi
 * adicionado nesta mesma dispatch — ver
 * rallye-api/api/internal/bookings/list_participants_handler.go. Decisão
 * registrada no relatório de execução (não uma pergunta em aberto: o
 * endpoint é read-only, reaproveita 100% o padrão já existente, e sem ele a
 * task em si — "Tela T3" — seria irrealizável).
 *
 * ## Banner "retroativo" — vem só da RESPOSTA do POST, nunca calculado aqui
 *
 * A janela de check-in (15min antes/30min depois) é regra do backend
 * (BEAC-1906) — esta tela NUNCA recalcula isso localmente; o banner só
 * aparece depois de uma tentativa de salvar cuja resposta trouxer
 * `retroactive: true` (decisão explícita do dispatch: "surface the
 * retroactive flag the API already returns").
 *
 * ## "Sair sem salvar" — window.confirm
 *
 * Não existe nenhum componente de diálogo de confirmação neste app ainda
 * (só BottomSheet, que não serve para uma pergunta sim/não bloqueante) —
 * `window.confirm` é a forma mínima e testável (mockável em teste) de
 * cobrir o AC sem introduzir um novo componente de UI para uma única tela.
 */
export default function CheckinPage() {
  const { unitId, bookingId } = useParams<{ unitId: string; bookingId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const booking = (location.state as { booking?: Booking } | null)?.booking

  const canCheckIn = usePermission('agenda', 'write')

  const [loadState, setLoadState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; participants: BookingParticipant[] }
  >({ status: 'loading' })
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | null>>({})
  const [initialStatuses, setInitialStatuses] = useState<Record<string, AttendanceStatus | null>>({})
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retroactiveBanner, setRetroactiveBanner] = useState(false)
  const toast = useToast()
  const navigatingAwayRef = useRef(false)

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    listBookingParticipants(bookingId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setLoadState({ status: 'error' })
        return
      }
      const snapshot: Record<string, AttendanceStatus | null> = {}
      for (const p of result.participants) snapshot[p.studentId] = p.attendanceStatus
      setInitialStatuses(snapshot)
      setStatuses(snapshot)
      setLoadState({ status: 'ready', participants: result.participants })
    })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  useEffect(() => {
    return () => {
      navigatingAwayRef.current = true
    }
  }, [])

  const participants = loadState.status === 'ready' ? loadState.participants : []

  const isDirty = useMemo(
    () => JSON.stringify(statuses) !== JSON.stringify(initialStatuses),
    [statuses, initialStatuses],
  )

  const summary = useMemo(() => {
    let presentes = 0
    let faltas = 0
    let justificadas = 0
    for (const status of Object.values(statuses)) {
      if (status === 'presente') presentes += 1
      else if (status === 'falta') faltas += 1
      else if (status === 'justificada') justificadas += 1
    }
    return { presentes, faltas, justificadas }
  }, [statuses])

  if (!unitId || !bookingId) return null

  function toggleStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: prev[studentId] === status ? null : status }))
  }

  function handleMarkAllPresent() {
    setStatuses((prev) => {
      const next = { ...prev }
      for (const p of participants) next[p.studentId] = 'presente'
      return next
    })
  }

  function handleBack() {
    if (isDirty && !window.confirm('Deseja sair sem salvar?')) return
    navigate(-1)
  }

  async function handleSave() {
    if (!bookingId) return
    const attendances = participants
      .filter((p) => statuses[p.studentId] != null)
      .map((p) => ({ studentId: p.studentId, status: statuses[p.studentId] as AttendanceStatus }))

    if (attendances.length === 0) {
      setErrorMessage('Marque o status de ao menos um aluno antes de salvar.')
      return
    }

    setErrorMessage(null)
    setSaving(true)
    const result = await submitAttendance(bookingId, attendances)
    setSaving(false)

    if (!result.ok) {
      toast.showError(result.message ?? `Não foi possível salvar a presença (${result.error}).`)
      return
    }

    setInitialStatuses(statuses)
    setRetroactiveBanner(result.retroactive)
    toast.showSuccess('Presença registrada!')
    window.setTimeout(() => {
      if (navigatingAwayRef.current) return
      navigate(-1)
    }, 900)
  }

  const headerSubtitle = booking ? formatCheckinSubtitle(booking) : null

  return (
    <>
      <div className="pg-head">
        <button type="button" className="back" onClick={handleBack}>
          ‹ Voltar
        </button>
        <div className="ck-head-main">
          <h1>Check-in de presença</h1>
          {headerSubtitle ? <div className="count">{headerSubtitle}</div> : null}
        </div>
        <div className="spacer" />
        {canCheckIn && booking ? (
          <button className="btn btn-primary btn-sm" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        ) : null}
      </div>

      <div className="dash-body">
        {!canCheckIn ? <p role="alert">Sem permissão para fazer check-in desta aula.</p> : null}

        {canCheckIn && !booking ? (
          <p role="alert">
            Não foi possível carregar os detalhes desta aula fora do fluxo da Agenda — volte e abra o
            check-in novamente a partir do detalhe da reserva. (Sem GET /bookings/{'{id}'} para deep link
            direto.)
          </p>
        ) : null}

        {canCheckIn && booking ? (
          <>
            {retroactiveBanner ? (
              <div role="status" className="ck-banner">
                Check-in fora do horário. Registrando retroativamente.
              </div>
            ) : null}

            {loadState.status === 'loading' ? <PageLoading label="Carregando alunos" variant="list" /> : null}
            {loadState.status === 'error' ? (
              <p role="alert">Não foi possível carregar a lista de alunos desta aula.</p>
            ) : null}

            {loadState.status === 'ready' && participants.length === 0 ? (
              <p className="hint">Nenhum aluno participante nesta aula.</p>
            ) : null}

            {loadState.status === 'ready' && participants.length > 0 ? (
              <>
                <button
                  className="btn btn-ghost btn-sm ck-all"
                  type="button"
                  onClick={handleMarkAllPresent}
                >
                  Marcar todos presentes
                </button>

                <div className="ag-list" style={{ gap: 8 }}>
                  {participants.map((p) => (
                    <StudentRow
                      key={p.studentId}
                      participant={p}
                      status={statuses[p.studentId] ?? null}
                      onToggle={(status) => toggleStatus(p.studentId, status)}
                    />
                  ))}
                </div>

                <div className="ck-summary">
                  <span className="ck-ok">✓ {summary.presentes} presentes</span>
                  <span className="ck-no">✕ {summary.faltas} faltas</span>
                  <span className="ck-ju">◐ {summary.justificadas} justificadas</span>
                </div>
              </>
            ) : null}

            {errorMessage ? (
              <p role="alert" className="field-error">
                {errorMessage}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <Toast message={toast.message} variant={toast.variant} onDismiss={toast.dismiss} />
    </>
  )
}

function StudentRow({
  participant,
  status,
  onToggle,
}: {
  participant: BookingParticipant
  status: AttendanceStatus | null
  onToggle: (status: AttendanceStatus) => void
}) {
  const name = participant.studentName ?? 'Aluno'
  return (
    <div className="ck-row">
      <span className="avatar-sm">{initials(name)}</span>
      <span className="nm">{name}</span>
      <div className="ck-tgl">
        <button
          type="button"
          className="ok"
          aria-pressed={status === 'presente'}
          aria-label={`Presente — ${name}`}
          onClick={() => onToggle('presente')}
        >
          ✓
        </button>
        <button
          type="button"
          className="no"
          aria-pressed={status === 'falta'}
          aria-label={`Falta — ${name}`}
          onClick={() => onToggle('falta')}
        >
          ✕
        </button>
        <button
          type="button"
          className="ju"
          aria-pressed={status === 'justificada'}
          aria-label={`Justificada — ${name}`}
          onClick={() => onToggle('justificada')}
        >
          ◐
        </button>
      </div>
    </div>
  )
}

/** Iniciais de 2 letras — mesmo padrão de MembersPage.tsx/AddStudentSheet.tsx
 * (duplicado aqui pelo mesmo motivo já documentado nesses arquivos: não
 * existe um util compartilhado para isso ainda neste projeto). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "BT intermediária · hoje 18:00 · Quadra 2" (`.count` do protótipo real,
 * `#scr-t3`) — nome da aula/turma (bookingTitle, agendaShared.ts) + data/hora
 * ("hoje HH:mm" se for hoje, senão "dd/mm HH:mm") + quadra. */
function formatCheckinSubtitle(booking: Booking): string {
  const start = new Date(booking.startAt)
  const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const isToday =
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth() &&
    start.getDate() === today.getDate()
  const dateLabel = isToday
    ? `hoje ${time}`
    : `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')} ${time}`
  return `${bookingTitle(booking)} · ${dateLabel} · ${booking.courtName}`
}
