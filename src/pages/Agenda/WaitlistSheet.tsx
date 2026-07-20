import { useCallback, useEffect, useState } from 'react'
import { getWaitlistStatus, joinWaitlist, leaveWaitlist } from '../../lib/api/waitlist'
import '../../components/AuthLayout/AuthLayout.css'
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
      <h2 className="sec-head-title">Fila de espera</h2>
      <p className="ssub">{classSchedule}</p>

      {state.status === 'loading' ? <p role="status">Carregando…</p> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível carregar a fila de espera agora.</p> : null}

      {state.status === 'ready' ? (
        <div className="stack">
          <div className="srow">
            <span className="lbl">Turma</span>
            <span>
              {state.activeEnrollments >= state.capacity ? 'Lotada · ' : ''}
              {state.activeEnrollments}/{state.capacity}
            </span>
          </div>
          <div className="srow">
            <span className="lbl">Fila</span>
            <span>
              {state.queueSize} {state.queueSize === 1 ? 'pessoa' : 'pessoas'}
              {inQueue
                ? ` · sua posição: #${state.yourPosition}`
                : queueFull
                  ? ''
                  : ` · sua posição seria #${state.queueSize + 1}`}
            </span>
          </div>

          <p role="status" className="toast toast-neutral">
            Se abrir vaga, você recebe uma notificação e abre a tela de confirmação com 2 horas pra aceitar. Se
            não confirmar, passa pro próximo. Sem cobrança nenhuma — waitlist só existe para turmas de
            mensalidade.
          </p>

          {queueFull ? (
            <p role="alert" className="waitlist-sheet-full">
              Waitlist cheia (5/5). Tente novamente mais tarde.
            </p>
          ) : (
            <button
              type="button"
              className={inQueue ? 'btn btn-ghost btn-md btn-full' : 'btn btn-primary btn-md btn-full'}
              disabled={submitting}
              onClick={inQueue ? handleLeave : handleJoin}
            >
              {submitting ? 'Aguarde…' : inQueue ? 'Sair da fila' : 'Entrar na fila'}
            </button>
          )}

          <label className="waitlist-sheet-toggle">
            <input type="checkbox" checked={notifyMe} onChange={(e) => setNotifyMe(e.target.checked)} />
            🔔 Me avise de qualquer vaga nesta turma
          </label>

          {submitError ? (
            <p role="alert" className="field-error">
              {submitError}
            </p>
          ) : null}

          <div className="foot-note">Fila FIFO · máx. 5 pessoas · você pode sair a qualquer momento.</div>
        </div>
      ) : null}

      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Fechar
      </button>
    </div>
  )
}
