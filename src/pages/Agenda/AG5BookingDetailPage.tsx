import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { cancelBooking, type Booking, type Participant } from '../../lib/api/bookings'
import { getMe } from '../../lib/api/me'
import { AddStudentSheet } from './AddStudentSheet'
import { RemarcarSheet, type RemarcarResult } from './RemarcarSheet'
import { bookingTitle, bookingTypeLabel } from './agendaShared'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'
import './AG5BookingDetailPage.css'

/**
 * AG5 — Detalhe da Aula/Reserva, BASE ONLY (BEAC-1905, story BEAC-1704).
 *
 * Não existe uma tela de Artifact dedicada `scr-ag5` em nenhum dos dois
 * artifacts fetchados (só é referenciada via o grid AG1/AG2) — MAS o
 * artifact "Rallye — Agenda" tem um `sheet-ag5` real (bottom sheet "detalhe
 * da reserva", linhas ~156-184 do HTML salvo) com os campos reais (Horário/
 * Quadra/Professor/Alunos/Status, lista de alunos em miniatura, ações do
 * admin) — usado aqui como referência SUPLEMENTAR de campos/copy (não
 * pixel-matched, e implementado como PÁGINA/rota, não sheet — "Tela AG5" no
 * texto do dispatch e o AC "navigate to a placeholder AG5 route" apontam
 * para rota, ao contrário de AG6 que é explicitamente chamado de "Bottom
 * sheet AG6"). Rota `/units/:unitId/bookings/:bookingId`.
 *
 * GAP CONHECIDO — sem GET /bookings/{id}: não existe (nem foi pedido neste
 * dispatch) um endpoint de leitura de UMA reserva por id — só o grid (GET
 * /units/{id}/bookings) e agora POST/PATCH. Por isso esta página recebe o
 * Booking já carregado via `location.state.booking` (AG1DayPage/
 * AG2WeekPage passam o objeto que já tinham em mão ao navegar, evitando
 * re-buscar) — abrir esta rota diretamente (deep link/refresh) sem esse
 * state não tem como carregar os dados; mostra um aviso claro em vez de
 * quebrar. Reportado como questão em aberto no relatório de dispatch.
 *
 * GAP CONHECIDO — sem sinal de "papel" (Aluno/Professor/Admin): GET
 * /me/permissions (BEAC-1840) só devolve module->actions, nunca um nome de
 * papel. A distinção de conteúdo por papel exigida pelo AC é inferida por
 * heurística (ver isAdmin/isStaff abaixo) — não é um sinal confiável, ver
 * relatório de dispatch.
 */
export default function AG5BookingDetailPage() {
  const { unitId, bookingId } = useParams<{ unitId: string; bookingId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const booking = (location.state as { booking?: Booking } | null)?.booking

  const isAdmin = usePermission('agenda', 'write')
  const isStaff = usePermission('alunos', 'read')
  const isProfessor = isStaff && !isAdmin
  const isAluno = !isStaff
  // Correção de review (BEAC-1707/1918): a busca de alunos usada pelo picker
  // (AddStudentSheet.tsx -> GET /units/{id}/members) exige a permission
  // config:write, NÃO agenda:write. Professor tem agenda:write (matriz de
  // seed, migrations/000016) então cai no bloco isAdmin acima (gap JÁ
  // conhecido e documentado no comentário de pacote deste arquivo — não
  // corrigido aqui), mas NÃO tem config:write — sem este gate adicional, o
  // botão "Adicionar aluno" apareceria para Professor e a busca sempre
  // devolveria 403 (fluxo sem saída). Só esconder o botão quando a busca que
  // ele abre de fato vai funcionar.
  const canSearchStudents = usePermission('config', 'write')

  const [actionsOpen, setActionsOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [addStudentSuccessMessage, setAddStudentSuccessMessage] = useState<string | null>(null)

  // remarcarOpen/loggedInStudentId: sheet AG7 "Remarcar" (BEAC-1912, story
  // BEAC-1705) — mesmo componente reaproveitado por AG3StudentAgendaPage.tsx.
  // GET /me (mesmo padrão de AG3) resolve o profile id do chamador — este
  // endpoint self-only (POST /students/{id}/reschedule) precisa dele.
  const [remarcarOpen, setRemarcarOpen] = useState(false)
  const [remarcarMessage, setRemarcarMessage] = useState<string | null>(null)
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) setLoggedInStudentId(result.id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!unitId || !bookingId) return null

  if (!booking) {
    return (
      <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
        <div className="pg-head">
          <Link className="back" to={`/units/${unitId}/agenda`}>
            ‹ Agenda
          </Link>
        </div>
        <p role="alert">
          Não foi possível carregar os detalhes desta reserva fora do fluxo do calendário — volte para a
          Agenda e toque no bloco novamente. (Sem GET /bookings/{'{id}'} para deep link direto — ver
          relatório de dispatch.)
        </p>
      </AppShell>
    )
  }

  function handleStudentAdded(participant: Participant) {
    setAddStudentOpen(false)
    setAddStudentSuccessMessage(
      participant.capacityWarning
        ? `${participant.studentName ?? 'Aluno'} adicionado (turma acima da capacidade recomendada).`
        : `${participant.studentName ?? 'Aluno'} adicionado à aula.`,
    )
  }

  async function handleConfirmCancel() {
    if (!cancelReason.trim()) {
      setMessage('Informe o motivo do cancelamento.')
      return
    }
    setCancelling(true)
    const result = await cancelBooking(bookingId!, cancelReason.trim())
    setCancelling(false)
    if (!result.ok) {
      setMessage(`Não foi possível cancelar (${result.error}).`)
      return
    }
    setActionsOpen(false)
    navigate(`/units/${unitId}/agenda`)
  }

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <Link className="back" to={`/units/${unitId}/agenda`}>
          ‹ Agenda
        </Link>
        <div className="spacer" />
      </div>

      <div className="dash-body ag5-body">
        <h1>{bookingTitle(booking)}</h1>
        <p className="ssub">
          {bookingTypeLabel(booking.type)} · {new Date(booking.startAt).toLocaleString('pt-BR')}
        </p>

        <div className="stack">
          <div className="srow">
            <span className="lbl">Horário</span>
            <span>
              {new Date(booking.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              –
              {new Date(booking.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="srow">
            <span className="lbl">Quadra</span>
            <span>{booking.courtName}</span>
          </div>
          {booking.type !== 'block' ? (
            <div className="srow">
              <span className="lbl">Professor</span>
              <span>{booking.teacherName ?? '—'}</span>
            </div>
          ) : null}
          {booking.type === 'private' ? (
            <div className="srow">
              <span className="lbl">Aluno</span>
              <span>{booking.studentName ?? '—'}</span>
            </div>
          ) : null}
          {booking.type === 'class_occurrence' ? (
            <div className="srow">
              <span className="lbl">Alunos</span>
              <span className="hint">
                Lista de alunos indisponível — não existe matrícula modelada no backend ainda (ver
                BEAC-1861/1862, gap documentado em api/internal/classes/handler.go).
              </span>
            </div>
          ) : null}
          {booking.responsibleName ? (
            <div className="srow">
              <span className="lbl">Responsável</span>
              <span>{booking.responsibleName}</span>
            </div>
          ) : null}
          {booking.type === 'block' ? (
            <div className="srow">
              <span className="lbl">Motivo</span>
              <span>{booking.reason ?? '—'}</span>
            </div>
          ) : null}
          <div className="srow">
            <span className="lbl">Status</span>
            <span className={`badge ${booking.status === 'confirmed' ? 'b-success' : 'b-muted'}`}>
              {booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
            </span>
          </div>
        </div>

        {addStudentSuccessMessage ? (
          <p role="status" className="hint">
            {addStudentSuccessMessage}
          </p>
        ) : null}

        {remarcarMessage ? (
          <p role="status" className="hint">
            {remarcarMessage}
          </p>
        ) : null}

        {isAluno ? (
          <div className="row ag5-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRemarcarOpen(true)}>
              Remarcar
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled
              title="POST /bookings/{id}/cancel-attendance já existe (BEAC-1909), mas fiar este botão a ele não fazia parte da task BEAC-1912 (só o sheet Remarcar) — não implementado neste dispatch"
            >
              Cancelar presença
            </button>
          </div>
        ) : null}

        {isProfessor ? (
          <div className="row ag5-actions">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => navigate(`/units/${unitId}/bookings/${bookingId}/checkin`, { state: { booking } })}
            >
              Abrir Check-in
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled
              title="FB1, não implementado neste dispatch"
            >
              Dar Feedback
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled
              title="Sem student_id no contrato de GET /units/{id}/bookings, só student_name — ver relatório de dispatch"
            >
              Ver perfil aluno
            </button>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="row ag5-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setActionsOpen(true)}>
              Ações
            </button>
          </div>
        ) : null}
      </div>

      <BottomSheet open={actionsOpen} onClose={() => setActionsOpen(false)} label="Ações">
        <h2>Ações</h2>
        <div className="stack">
          {booking.type === 'class_occurrence' && canSearchStudents ? (
            <button
              className="btn btn-ghost btn-sm btn-full"
              type="button"
              onClick={() => {
                setActionsOpen(false)
                setAddStudentSuccessMessage(null)
                setAddStudentOpen(true)
              }}
            >
              👤 Adicionar aluno
            </button>
          ) : null}
          <button className="btn btn-ghost btn-sm btn-full" type="button" disabled title="Sem endpoint de edição de reserva ainda">
            Editar reserva
          </button>
          <button className="btn btn-ghost btn-sm btn-full" type="button" disabled title="Sem endpoint de realocação ainda">
            Realocar quadra
          </button>
          <button className="btn btn-ghost btn-sm btn-full" type="button" disabled title="Sem endpoint de notificação ainda">
            Notificar alunos
          </button>

          <div className="field">
            <label htmlFor="ag5-cancel-reason">Motivo do cancelamento</label>
            <textarea
              id="ag5-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          {message ? (
            <p role="alert" className="field-error">
              {message}
            </p>
          ) : null}
          <button
            className="btn btn-danger btn-sm btn-full"
            type="button"
            disabled={cancelling}
            onClick={handleConfirmCancel}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar aula'}
          </button>
          <div className="foot-note">
            Cancelamento (status=cancelled). Desde BEAC-1913 (story BEAC-1705), o backend gera automaticamente
            um crédito de reagendamento para CADA aluno matriculado nesta ocorrência — sem ação adicional
            aqui na UI (o crédito aparece pro aluno no sheet Remarcar, AG7).
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={addStudentOpen} onClose={() => setAddStudentOpen(false)} label="Adicionar aluno">
        {unitId ? (
          <AddStudentSheet
            unitId={unitId}
            bookingId={bookingId!}
            onAdded={handleStudentAdded}
            onCancel={() => setAddStudentOpen(false)}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet open={remarcarOpen} onClose={() => setRemarcarOpen(false)} label="Remarcar">
        {unitId && loggedInStudentId ? (
          <RemarcarSheet
            unitId={unitId}
            studentId={loggedInStudentId}
            onRescheduled={(result: RemarcarResult) => {
              setRemarcarOpen(false)
              setRemarcarMessage(
                result.status === 'pending_approval'
                  ? 'Pedido de remarcação enviado — aguardando aprovação do admin.'
                  : 'Remarcação aplicada com sucesso!',
              )
            }}
            onCancel={() => setRemarcarOpen(false)}
          />
        ) : (
          <p role="alert">Não foi possível identificar sua conta para remarcar (tente recarregar a página).</p>
        )}
      </BottomSheet>
    </AppShell>
  )
}
