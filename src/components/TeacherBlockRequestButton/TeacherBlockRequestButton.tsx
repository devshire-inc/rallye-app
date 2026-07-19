import { type FormEvent, useState } from 'react'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import { createTeacherBlockRequest } from '../../lib/api/blockRequests'
import { computeAffectedClasses, type TeacherAgendaClass } from './affectedClasses'
import './TeacherBlockRequestButton.css'

export type { TeacherAgendaClass }

export interface TeacherBlockRequestButtonProps {
  /** Id do professor dono da agenda — sempre o PRÓPRIO chamador (BEAC-1888's
   * AC: "só o próprio professor pode criar solicitação para si mesmo, nunca
   * para outro professor"). Este componente não expõe nenhuma forma de
   * solicitar em nome de outro professor. */
  teacherId: string
  /** Aulas já carregadas na agenda do professor (AG4/telas irmãs) — usadas
   * só para o cálculo local do box "Isso afeta:", sem nenhuma chamada de
   * API adicional. */
  classes: TeacherAgendaClass[]
}

// Exact copy locked pelo protótipo real (ver handover de execução de
// BEAC-1889) — não parafrasear.
const SHEET_TITLE = 'Solicitar indisponibilidade'
const SHEET_SUBTITLE =
  'Vira um pedido pendente — o admin aprova cancelando a aula ou escalando um substituto.'
const REASON_LABEL = 'Motivo'
const REASON_PLACEHOLDER = 'Ex.: consulta médica, viagem...'
const REASON_REQUIRED_MESSAGE = 'Conte o motivo pra o admin decidir.'
const SUCCESS_MESSAGE = 'Solicitação enviada! Entrou na Central de Pendências do admin.'
const GENERIC_ERROR_MESSAGE = 'Não foi possível enviar a solicitação agora. Tente novamente.'
const DISCLAIMER_TEXT =
  'O admin decide: cancelar a aula (alunos recebem crédito) ou escalar um professor substituto só para essa data — nunca reatribui a turma de forma permanente.'

function formatAffectedClassLine(klass: TeacherAgendaClass): string {
  return `${klass.name} · ${klass.daysLabel} ${klass.time} · ${klass.court} · ${klass.studentCount} alunos.`
}

/**
 * Botão "Solicitar bloqueio" + bottom sheet "Solicitar indisponibilidade"
 * (BEAC-1889, story BEAC-1702): formulário de Motivo (obrigatório) + período
 * De/Até, com um box informativo mostrando quais aulas da agenda do próprio
 * professor caem no período pedido (computado localmente, ver
 * affectedClasses.ts — nenhum endpoint novo). Submit chama
 * POST /teachers/{id}/block-requests (BEAC-1888); sucesso mostra um painel
 * verde INLINE acima do botão de envio — a sheet permanece aberta (não é um
 * toast/overlay).
 *
 * Pensado para ser colocado direto no header de AG4 ("Minha Agenda —
 * Professor") assim que essa tela existir (ver comentário do handover de
 * execução: AG4 ainda não existe neste repo, fora de escopo desta story) —
 * este componente já é auto-contido (dono do próprio botão-gatilho e do
 * estado de abertura da sheet), então usá-lo lá será só
 * `<TeacherBlockRequestButton teacherId={...} classes={...} />` no lugar
 * certo do `.ag-head`.
 *
 * Sem toggle de "sugerir substituto" nem person-picker — confirmado
 * ausente no protótipo real por interação direta (ver handover de
 * execução): `substitute_teacher_id` só é preenchido pela decisão do admin
 * (BEAC-1891, fora de escopo), nunca na criação.
 *
 * Ícone de calendário no botão: omitido, mesmo precedente já adotado neste
 * app (ver comentário de pacote de RoleAuditPanel.tsx sobre o ícone
 * `i-clock` do protótipo real de C3) — `public/icons.svg` não tem um ícone
 * de calendário, e a convenção já estabelecida aqui é omitir em vez de
 * inventar um SVG novo ad hoc.
 */
export function TeacherBlockRequestButton({ teacherId, classes }: TeacherBlockRequestButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function resetState() {
    setReason('')
    setStartDate('')
    setEndDate('')
    setReasonError(null)
    setSubmitError(null)
    setSuccess(false)
  }

  function handleClose() {
    setOpen(false)
    resetState()
  }

  function handleReasonChange(value: string) {
    setReason(value)
    if (reasonError) setReasonError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setReasonError(REASON_REQUIRED_MESSAGE)
      return
    }

    setReasonError(null)
    setSubmitError(null)
    setSubmitting(true)
    const result = await createTeacherBlockRequest(teacherId, {
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      reason: trimmedReason,
    })
    setSubmitting(false)

    if (!result.ok) {
      setSubmitError(result.message ?? GENERIC_ERROR_MESSAGE)
      return
    }

    setSuccess(true)
  }

  const affectedClasses = computeAffectedClasses(classes, startDate, endDate)

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm teacher-block-request-button__trigger"
        onClick={() => setOpen(true)}
      >
        Solicitar bloqueio
      </button>

      <BottomSheet open={open} onClose={handleClose} label={SHEET_TITLE}>
        <div className="teacher-block-request-sheet">
          <h2>{SHEET_TITLE}</h2>
          <p className="section-desc">{SHEET_SUBTITLE}</p>

          <form onSubmit={handleSubmit} className="stack">
            <div className={reasonError ? 'field error' : 'field'}>
              <label htmlFor="block-request-reason">{REASON_LABEL}</label>
              <input
                id="block-request-reason"
                className="input"
                type="text"
                placeholder={REASON_PLACEHOLDER}
                value={reason}
                disabled={submitting || success}
                onChange={(e) => handleReasonChange(e.target.value)}
              />
              {reasonError ? (
                <p role="alert" className="field-error">
                  {reasonError}
                </p>
              ) : null}
            </div>

            <div className="teacher-block-request-sheet__date-grid">
              <div className="field">
                <label htmlFor="block-request-start">De</label>
                <input
                  id="block-request-start"
                  type="datetime-local"
                  value={startDate}
                  disabled={submitting || success}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="block-request-end">Até</label>
                <input
                  id="block-request-end"
                  type="datetime-local"
                  value={endDate}
                  disabled={submitting || success}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {affectedClasses.length > 0 ? (
              <div className="teacher-block-request-sheet__affected-box" role="status">
                <strong>Isso afeta:</strong>
                <ul>
                  {affectedClasses.map((klass) => (
                    <li key={klass.id}>{formatAffectedClassLine(klass)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {submitError ? (
              <p role="alert" className="teacher-block-request-sheet__submit-error">
                {submitError}
              </p>
            ) : null}

            {success ? (
              <div
                role="status"
                aria-label="Solicitação enviada"
                className="teacher-block-request-sheet__success"
              >
                {SUCCESS_MESSAGE}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary btn-md btn-full"
              disabled={submitting || success}
            >
              {submitting ? 'Enviando…' : 'Enviar solicitação'}
            </button>

            <p className="teacher-block-request-sheet__disclaimer">{DISCLAIMER_TEXT}</p>
          </form>
        </div>
      </BottomSheet>
    </>
  )
}
