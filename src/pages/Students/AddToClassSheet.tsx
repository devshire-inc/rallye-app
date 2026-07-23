import { useEffect, useState } from 'react'
import { listClasses, type RallyeClass } from '../../lib/api/classes'
import { createEnrollment } from '../../lib/api/enrollments'
import { sportCssVar, sportLabel } from '../../lib/sports'
import { formatDaysAndStart } from '../Turmas/turmasShared'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; classes: RallyeClass[] }

export interface AddToClassSheetProps {
  unitId: string
  studentId: string
  /** IDs de turma em que este aluno já tem matrícula ATIVA — excluídas da
   * lista (evita convidar o admin a repetir uma matrícula que o backend só
   * rejeitaria com 409 already_enrolled). */
  excludeClassIds: Set<string>
  onEnrolled: () => void
  onClose: () => void
}

/**
 * Conteúdo do BottomSheet "Adicionar a turma" da aba Turmas de AL2
 * (BEAC-1864, ver ClassHistorySection.tsx). Lista as turmas ATIVAS da unit
 * (GET /units/{id}/classes, ../../lib/api/classes.ts — mesmo endpoint de T1)
 * e matricula o aluno na turma escolhida via POST /classes/{id}/enrollments
 * (BEAC-1862/BEAC-1692, já implementado no backend — ver comentário de
 * módulo de ../../lib/api/enrollments.ts; esta task só precisava encontrar e
 * reaproveitar esse endpoint, não inventar um novo).
 *
 * Sem tela própria no protótipo para este picker (o Artifact só mostra o
 * botão "Adicionar a turma" de AL2, sem um fluxo de seleção desenhado) —
 * reaproveita o mesmo padrão de lista `.ag-list`/`.p-row` já usado pela
 * própria aba Turmas (mesmo componente visual, evita inventar um layout
 * novo sem referência).
 */
export function AddToClassSheet({
  unitId,
  studentId,
  excludeClassIds,
  onEnrolled,
  onClose,
}: AddToClassSheetProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [pendingClassId, setPendingClassId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listClasses(unitId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', classes: result.classes })
    })
    return () => {
      cancelled = true
    }
  }, [unitId])

  async function handleEnroll(classId: string) {
    setError(null)
    setPendingClassId(classId)
    const result = await createEnrollment(classId, studentId)
    setPendingClassId(null)
    if (!result.ok) {
      setError(
        result.error === 'already_enrolled'
          ? 'Este aluno já está matriculado nesta turma.'
          : 'Não foi possível matricular o aluno. Tente novamente.',
      )
      return
    }
    onEnrolled()
  }

  const candidates =
    state.status === 'ready'
      ? state.classes.filter((c) => c.status === 'active' && !excludeClassIds.has(c.id))
      : []

  return (
    <div className="ptab-panel">
      <div className="sec-head">
        <h2>Adicionar a turma</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar
        </button>
      </div>

      {state.status === 'loading' ? <p role="status">Carregando turmas…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar as turmas desta arena.</p>
      ) : null}
      {state.status === 'ready' && candidates.length === 0 ? (
        <p className="hint">Nenhuma turma disponível para matrícula.</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}

      {candidates.length > 0 ? (
        <div className="ag-list">
          {candidates.map((classItem) => (
            <button
              type="button"
              key={classItem.id}
              className="p-row"
              disabled={pendingClassId !== null}
              data-testid={`add-to-class-row-${classItem.id}`}
              onClick={() => handleEnroll(classItem.id)}
            >
              <span
                className="strip"
                style={{ background: `var(${sportCssVar(classItem.sport)})` }}
              />
              <span className="pw">
                <span className="nm">{classItem.name}</span>
                <span className="mt">
                  {sportLabel(classItem.sport)} ·{' '}
                  {formatDaysAndStart(classItem.rrule, classItem.startTime)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
