import { useCallback, useEffect, useState } from 'react'
import { getWaitlistStatus, joinWaitlist, leaveWaitlist } from '../../lib/api/waitlist'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
import './WaitlistSheet.css'

export interface WaitlistJoinedResult {
  position: number
}

export interface WaitlistSheetProps {
  classId: string
  studentId: string
  /** Nome da turma + data/hora/quadra, já formatado pelo chamador (ex.:
   * "Futevôlei avançado · sáb 12 jul, 09:00 · Quadra 6") — cópia exata do
   * subtítulo de `#sheet-ag8` no protótipo real. */
  classSchedule: string
  /** Chamado depois que o aluno entrou na fila com sucesso — mesmo espírito
   * de RemarcarSheet.onRescheduled: quem usa este sheet decide se/como
   * fecha e mostra uma mensagem de sucesso na página. */
  onJoined?: (result: WaitlistJoinedResult) => void
  onCancel: () => void
}

const MAX_QUEUE_SIZE = 5

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; activeEnrollments: number; capacity: number; queueSize: number; yourPosition: number | null }

const ERROR_MESSAGES: Record<string, string> = {
  class_not_full: 'Esta turma ainda não está lotada.',
  queue_full: 'Waitlist cheia (5/5). Tente novamente mais tarde.',
  already_in_queue: 'Você já está na fila de espera desta turma.',
}

/**
 * AG8 — bottom sheet "Fila de espera" (BEAC-1922, story BEAC-1708). Cópia
 * visual de `#sheet-ag8` no protótipo real (Artifact "Rallye — Agenda") para
 * o que ele mostra — MAIS 2 elementos que o protótipo não tem mas o doc
 * AG8/AC desta task exigem (decisão confirmada com o usuário durante a
 * execução, já que o protótipo ficou desatualizado nesse ponto):
 *
 *   1. Toggle "Me avise de qualquer vaga nesta turma" — GAP CONHECIDO:
 *      client-side apenas, SEM persistência (não existe endpoint/coluna
 *      pra isso em nenhuma das 4 tasks de backend desta story). Reseta ao
 *      desmontar/recarregar a página — decisão explícita desta task, não
 *      um bug.
 *   2. Estado "Fila cheia (5/5)" — mostrado tanto proativamente (GET
 *      /classes/{id}/waitlist já devolve queue_size >= 5 antes de tentar
 *      entrar) quanto reativamente (se a fila encher entre o carregamento
 *      do sheet e o clique em "Entrar na fila", o POST devolve 409
 *      queue_full e a mensagem de erro já usa a cópia exata do doc AG8).
 *
 * # GET /classes/{id}/waitlist — gap de leitura coberto nesta mesma dispatch
 *
 * Nenhuma das 4 tasks de backend (BEAC-1919/1920/1921/1924) previu um GET —
 * só POST (entrar) e DELETE (sair). Sem ele, "ocupação atual/tamanho da
 * fila/posição estimada" (AC desta task) não são atendíveis ANTES do aluno
 * clicar em algo. Endpoint adicionado nesta dispatch (ver
 * ../../lib/api/waitlist.ts e api/internal/waitlist/status_handler.go) —
 * mesmo precedente já usado pelo sheet AG7/RemarcarSheet.tsx
 * (list_credits_handler.go) para um gap idêntico nesta mesma story.
 *
 * # Sem wiring de host page — decisão desta task
 *
 * Este componente é standalone (props + callbacks, mesmo contrato de
 * RemarcarSheet/AddStudentSheet), pronto para ser aberto por uma página
 * anfitriã (candidatos naturais: AG3StudentAgendaPage quando uma turma está
 * cheia, ou TurmaDetailPage.tsx, que já tem uma aba "Waitlist" reservada).
 * Qual página deve abrir este sheet é uma decisão de navegação/produto fora
 * do que BEAC-1922 pede ("Files Likely Involved" lista só o componente do
 * sheet) — não adivinhada aqui, reportada como questão em aberto no
 * relatório de execução.
 *
 * # Reskin DS (grupo "Agendamento", handover desta dispatch)
 *
 * Título próprio removido — `AG3StudentAgendaPage` já abre este sheet dentro
 * de `<BottomSheet label="Fila de espera">`, que renderiza o título no
 * header do sheet (ver node Figma 163:5163: lá o título faz parte da página
 * cheia, aqui o wrapper já cobre esse papel). O toggle "Me avise..." virou
 * um botão real com `aria-pressed` (o Figma mostra um link, não um
 * checkbox) — o estado `notifyMe` e seu comportamento client-side-only não
 * mudaram.
 */
export function WaitlistSheet({ classId, studentId, classSchedule, onJoined, onCancel }: WaitlistSheetProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [notifyMe, setNotifyMe] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      getWaitlistStatus(classId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({
            status: 'ready',
            activeEnrollments: result.activeEnrollments,
            capacity: result.capacity,
            queueSize: result.queueSize,
            yourPosition: result.yourPosition,
          })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [classId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleJoin() {
    if (submitting) return
    setSubmitError(null)
    setSubmitting(true)
    const result = await joinWaitlist(classId)
    setSubmitting(false)

    if (!result.ok) {
      setSubmitError(ERROR_MESSAGES[result.error] ?? 'Não foi possível entrar na fila agora. Tente novamente.')
      load(() => false)
      return
    }

    setState((prev) =>
      prev.status === 'ready' ? { ...prev, yourPosition: result.position, queueSize: prev.queueSize + 1 } : prev,
    )
    onJoined?.({ position: result.position })
  }

  async function handleLeave() {
    if (submitting) return
    setSubmitError(null)
    setSubmitting(true)
    const result = await leaveWaitlist(classId, studentId)
    setSubmitting(false)

    if (!result.ok) {
      setSubmitError('Não foi possível sair da fila agora. Tente novamente.')
      return
    }

    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, yourPosition: null, queueSize: Math.max(0, prev.queueSize - 1) }
        : prev,
    )
  }

  const inQueue = state.status === 'ready' && state.yourPosition !== null
  const queueFull = state.status === 'ready' && !inQueue && state.queueSize >= MAX_QUEUE_SIZE

  return (
    <div className="waitlist-sheet">
      <p className="ssub">Essa turma está cheia — mas você pode entrar na fila.</p>

      {state.status === 'loading' ? (
        <div role="status">
          <AlertCard tone="info">Carregando…</AlertCard>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div role="alert">
          <AlertCard tone="danger" showIcon>
            Não foi possível carregar a fila de espera agora.
          </AlertCard>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="stack">
          <Card>
            <div className="waitlist-sheet-card">
              <p className="waitlist-sheet-card-title">{classSchedule}</p>
              <Badge tone="warning">
                ⏱ Turma lotada · {state.activeEnrollments} de {state.capacity} vagas
              </Badge>
              <hr className="waitlist-sheet-divider" />
              <div className="srow">
                <span className="lbl">Pessoas na fila</span>
                <span>{state.queueSize}</span>
              </div>
              <div className="srow">
                <span className="lbl">{inQueue ? 'Sua posição' : 'Sua posição seria'}</span>
                <span className="waitlist-sheet-position">
                  {inQueue ? `#${state.yourPosition}` : queueFull ? '—' : `#${state.queueSize + 1}`}
                </span>
              </div>
            </div>
          </Card>

          <div role="status">
            <AlertCard tone="info" showIcon>
              Quando uma vaga abrir, você recebe uma notificação e tem 2h para confirmar. Se não confirmar a tempo,
              a vaga passa para o próximo da fila. Sem cobrança nenhuma — waitlist só existe para turmas de
              mensalidade.
            </AlertCard>
          </div>

          {queueFull ? (
            <div role="alert">
              <AlertCard tone="warning" showIcon>
                Waitlist cheia (5/5). Tente novamente mais tarde.
              </AlertCard>
            </div>
          ) : (
            <Button
              variant={inQueue ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              loading={submitting}
              onClick={inQueue ? handleLeave : handleJoin}
            >
              {inQueue ? 'Sair da fila' : 'Entrar na fila'}
            </Button>
          )}

          <button
            type="button"
            className="waitlist-sheet-notify"
            aria-pressed={notifyMe}
            onClick={() => setNotifyMe((v) => !v)}
          >
            {notifyMe ? '✓ Você será avisado de qualquer vaga nesta turma' : 'Me avise de qualquer vaga nesta turma'}
          </button>

          {submitError ? (
            <div role="alert">
              <AlertCard tone="danger" showIcon>
                {submitError}
              </AlertCard>
            </div>
          ) : null}

          <div className="foot-note">Fila FIFO · máx. 5 pessoas · você pode sair a qualquer momento.</div>
        </div>
      ) : null}

      <Button variant="ghost" size="sm" onClick={onCancel}>
        Fechar
      </Button>
    </div>
  )
}
