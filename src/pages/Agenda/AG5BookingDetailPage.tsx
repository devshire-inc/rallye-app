import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import { Input } from '../../components/ui/Input/Input'
import { usePermission } from '../../hooks/usePermission'
import { cancelBooking, type Booking, type Participant } from '../../lib/api/bookings'
import { useMe } from '../../hooks/useMe'
import { AddStudentSheet } from './AddStudentSheet'
import { RemarcarSheet, type RemarcarResult } from './RemarcarSheet'
import { WaitlistSheet, type WaitlistJoinedResult } from './WaitlistSheet'
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
 *
 * RESKIN (rodada posterior, sem story própria — mesmo padrão do reskin de
 * AG3StudentAgendaPage.tsx): componentes reais do design system (Card/Badge/
 * Button/AlertCard/Input), seguindo os frames Figma "03 · Detalhe de Reserva
 * — Aluno — Mobile" (36:1119) e "— Desktop" (100:2575). Nenhuma lógica de
 * negócio, fetch ou fluxo de cancelamento foi alterado — só a casca visual.
 *
 * MAPEAMENTO "03b · Confirmar Cancelamento — Aluno — Mobile" (152:2646): o
 * 03b é um sheet de confirmação separado (título + parágrafo estático +
 * botão "Sim, cancelar presença" cheio + botão "Voltar") para o fluxo
 * self-service "Cancelar presença" (aluno cancela SÓ a própria presença) —
 * que nesta página está com o botão propositalmente `disabled` (ver abaixo,
 * endpoint existe mas fiar este botão a ele não fazia parte da task
 * BEAC-1912/1912). O único fluxo de cancelamento que REALMENTE executa
 * nesta tela é o admin, dentro do sheet "Ações" (`handleConfirmCancel`,
 * cancela a reserva/ocorrência inteira, motivo obrigatório). Em vez de
 * inventar um segundo sheet de confirmação sem lógica por trás, o
 * subseção de cancelamento do sheet "Ações" foi reestilizada no ESPÍRITO
 * do 03b (título + parágrafo explicativo + botão de perigo cheio) — ver
 * `.ag5-cancel-section` abaixo. O 03b não modela nenhum campo de motivo
 * (o cancelamento de presença não pede motivo); como o cancelamento real
 * (admin) EXIGE motivo (`cancelReason`, validado em `handleConfirmCancel`),
 * esse campo foi mapeado para `Input` (texto livre — Figma não mostra
 * select/radio em nenhum dos 3 frames, então não há ambiguidade de tipo de
 * campo) e mantido, mesmo sem equivalente visual direto no 03b. Documentado
 * como decisão de mapeamento no relatório do reskin (não uma pergunta em
 * aberto).
 */
export default function AG5BookingDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
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
  // endpoint self-only (POST /students/{id}/reschedule) precisa dele. Vem do
  // cache compartilhado (hooks/useMe.ts), não de um fetch próprio.
  const [remarcarOpen, setRemarcarOpen] = useState(false)
  const [remarcarMessage, setRemarcarMessage] = useState<string | null>(null)
  const loggedInStudentId = useMe().me?.id

  // waitlistOpen/waitlistTarget: sheet AG8 "Fila de espera" (BEAC-1922, story
  // BEAC-1708), aberto a partir de uma linha lotada dentro do sheet AG7
  // "Remarcar" (RemarcarSheet.onRequestWaitlist) — mesmo padrão de
  // AG3StudentAgendaPage.tsx (correção desta rodada).
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistTarget, setWaitlistTarget] = useState<{ classId: string; classSchedule: string } | null>(null)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)

  if (!unitId || !bookingId) return null

  if (!booking) {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <div className="pg-head">
          <Link className="ag5-back" to={`/units/${unitId}/agenda`}>
            ‹ Voltar
          </Link>
        </div>
        <div role="alert" className="ag5-body">
          <AlertCard tone="danger" showIcon>
            Não foi possível carregar os detalhes desta reserva fora do fluxo do calendário — volte para a
            Agenda e toque no bloco novamente. (Sem GET /bookings/{'{id}'} para deep link direto — ver
            relatório de dispatch.)
          </AlertCard>
        </div>
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

  const isConfirmed = booking.status === 'confirmed'

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="ag5-back" to={`/units/${unitId}/agenda`}>
          ‹ Voltar
        </Link>
        <div className="spacer" />
      </div>

      <div className="dash-body ag5-body">
        <div className="ag5-heading">
          <h1>{bookingTitle(booking)}</h1>
          <p className="ag5-subtitle">
            {bookingTypeLabel(booking.type)} · {new Date(booking.startAt).toLocaleString('pt-BR')}
          </p>
        </div>

        <Card>
          <div className="ag5-rows">
            <div className="ag5-row">
              <span className="ag5-row-label">Horário</span>
              <span className="ag5-row-value">
                {new Date(booking.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(booking.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="ag5-row">
              <span className="ag5-row-label">Quadra</span>
              <span className="ag5-row-value">{booking.courtName}</span>
            </div>
            {booking.type !== 'block' ? (
              <div className="ag5-row">
                <span className="ag5-row-label">Professor</span>
                <span className="ag5-row-value">{booking.teacherName ?? '—'}</span>
              </div>
            ) : null}
            {booking.type === 'private' ? (
              <div className="ag5-row">
                <span className="ag5-row-label">Aluno</span>
                <span className="ag5-row-value">{booking.studentName ?? '—'}</span>
              </div>
            ) : null}
            {booking.type === 'class_occurrence' ? (
              <div className="ag5-row">
                <span className="ag5-row-label">Alunos</span>
                <span className="ag5-row-value ag5-row-value--hint">
                  Lista de alunos indisponível — não existe matrícula modelada no backend ainda (ver
                  BEAC-1861/1862, gap documentado em api/internal/classes/handler.go).
                </span>
              </div>
            ) : null}
            {booking.responsibleName ? (
              <div className="ag5-row">
                <span className="ag5-row-label">Responsável</span>
                <span className="ag5-row-value">{booking.responsibleName}</span>
              </div>
            ) : null}
            {booking.type === 'block' ? (
              <div className="ag5-row">
                <span className="ag5-row-label">Motivo</span>
                <span className="ag5-row-value">{booking.reason ?? '—'}</span>
              </div>
            ) : null}
            <div className="ag5-row">
              <span className="ag5-row-label">Status</span>
              <Badge tone={isConfirmed ? 'success' : 'neutral'}>{isConfirmed ? '✓ Confirmada' : 'Cancelada'}</Badge>
            </div>
          </div>

          {isAluno && isConfirmed && booking.type === 'class_occurrence' ? (
            <div className="ag5-note">
              <AlertCard tone="warning">
                <strong>Cancele até 24h antes e ganhe 1 crédito</strong>
                <p>
                  O crédito vale para remarcar qualquer aula no mês vigente. Com menos de 24h, o cancelamento não
                  gera crédito.
                </p>
              </AlertCard>
            </div>
          ) : null}
        </Card>

        {addStudentSuccessMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {addStudentSuccessMessage}
            </AlertCard>
          </div>
        ) : null}

        {remarcarMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {remarcarMessage}
            </AlertCard>
          </div>
        ) : null}

        {waitlistMessage ? (
          <div role="status">
            <AlertCard tone="success" showIcon>
              {waitlistMessage}
            </AlertCard>
          </div>
        ) : null}

        {isAluno ? (
          <div className="ag5-actions ag5-actions--split">
            <Button variant="soft" size="md" onClick={() => setRemarcarOpen(true)}>
              Remarcar
            </Button>
            <div className="ag5-cancel-attendance">
              <Button
                variant="soft"
                size="md"
                fullWidth
                disabled
                title="POST /bookings/{id}/cancel-attendance já existe (BEAC-1909), mas fiar este botão a ele não fazia parte da task BEAC-1912 (só o sheet Remarcar) — não implementado neste dispatch"
              >
                Cancelar presença
              </Button>
            </div>
          </div>
        ) : null}

        {isProfessor ? (
          <div className="ag5-actions">
            <Button
              variant="ghost"
              size="md"
              onClick={() => navigate(`/units/${unitId}/bookings/${bookingId}/checkin`, { state: { booking } })}
            >
              Abrir Check-in
            </Button>
            <Button variant="ghost" size="md" disabled title="FB1, não implementado neste dispatch">
              Dar Feedback
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled
              title="Sem student_id no contrato de GET /units/{id}/bookings, só student_name — ver relatório de dispatch"
            >
              Ver perfil aluno
            </Button>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="ag5-actions">
            <Button variant="primary" size="md" onClick={() => setActionsOpen(true)}>
              Ações
            </Button>
          </div>
        ) : null}
      </div>

      <BottomSheet open={actionsOpen} onClose={() => setActionsOpen(false)} label="Ações">
        <div className="ag5-actions-sheet">
          {booking.type === 'class_occurrence' && canSearchStudents ? (
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => {
                setActionsOpen(false)
                setAddStudentSuccessMessage(null)
                setAddStudentOpen(true)
              }}
            >
              👤 Adicionar aluno
            </Button>
          ) : null}
          <Button variant="ghost" size="md" fullWidth disabled title="Sem endpoint de edição de reserva ainda">
            Editar reserva
          </Button>
          <Button variant="ghost" size="md" fullWidth disabled title="Sem endpoint de realocação ainda">
            Realocar quadra
          </Button>
          <Button variant="ghost" size="md" fullWidth disabled title="Sem endpoint de notificação ainda">
            Notificar alunos
          </Button>

          {/* Subseção de cancelamento — reestilizada no espírito do frame Figma
           * "03b · Confirmar Cancelamento" (título + parágrafo + botão de
           * perigo cheio); ver comentário de módulo no topo do arquivo sobre
           * por que o campo Motivo (sem equivalente no 03b) foi mantido como
           * Input. */}
          <div className="ag5-cancel-section">
            <h3>Cancelar aula</h3>
            <p>
              Cancelamento (status=cancelled). Desde BEAC-1913 (story BEAC-1705), o backend gera automaticamente
              um crédito de reagendamento para CADA aluno matriculado nesta ocorrência — sem ação adicional
              aqui na UI (o crédito aparece pro aluno no sheet Remarcar, AG7).
            </p>
            <Input
              label="Motivo do cancelamento"
              id="ag5-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            {message ? (
              <div role="alert">
                <AlertCard tone="danger" showIcon>
                  {message}
                </AlertCard>
              </div>
            ) : null}
            <Button variant="danger" size="md" fullWidth disabled={cancelling} onClick={handleConfirmCancel}>
              {cancelling ? 'Cancelando…' : 'Cancelar aula'}
            </Button>
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
            onRequestWaitlist={(classId, classSchedule) => {
              setRemarcarOpen(false)
              setWaitlistMessage(null)
              setWaitlistTarget({ classId, classSchedule })
              setWaitlistOpen(true)
            }}
            onCancel={() => setRemarcarOpen(false)}
          />
        ) : (
          <p role="alert">Não foi possível identificar sua conta para remarcar (tente recarregar a página).</p>
        )}
      </BottomSheet>

      <BottomSheet open={waitlistOpen} onClose={() => setWaitlistOpen(false)} label="Fila de espera">
        {waitlistTarget && loggedInStudentId ? (
          <WaitlistSheet
            classId={waitlistTarget.classId}
            studentId={loggedInStudentId}
            classSchedule={waitlistTarget.classSchedule}
            onJoined={(result: WaitlistJoinedResult) => {
              setWaitlistOpen(false)
              setWaitlistMessage(`Você entrou na fila de espera — posição #${result.position}.`)
            }}
            onCancel={() => setWaitlistOpen(false)}
          />
        ) : (
          <p role="alert">Não foi possível identificar sua conta para entrar na fila (tente recarregar a página).</p>
        )}
      </BottomSheet>
    </AppShell>
  )
}
