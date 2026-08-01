import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { Badge } from '../../components/ui/Badge/Badge'
import { usePermission } from '../../hooks/usePermission'
import { listClassHistory, type ClassHistoryItem } from '../../lib/api/classHistory'
import { sportCssVar } from '../../lib/sports'
import { formatDays, teacherDisplay } from '../Turmas/turmasShared'
import { AddToClassSheet } from './AddToClassSheet'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: ClassHistoryItem[] }

/** "ter & qui 18:00" — dias + horário de início, SEM vírgula entre eles
 * (cópia exata do protótipo real, scr-al2 data-pp="turmas": "ter & qui
 * 18:00 · Prof. Marcus"). Diferente de turmasShared.formatDaysAndStart
 * ("ter & qui, 18:00", COM vírgula — cópia de T1/scr-t1), que não serve aqui
 * — as duas telas do protótipo usam pontuação diferente para o mesmo dado,
 * então não há uma única função compartilhável sem forçar uma das duas a
 * divergir do próprio protótipo. */
function scheduleLabel(item: Pick<ClassHistoryItem, 'rrule' | 'startTime'>): string {
  const days = formatDays(item.rrule)
  return days ? `${days} ${item.startTime}` : item.startTime
}

export interface ClassHistorySectionProps {
  unitId: string
  studentId: string
}

/**
 * Aba "Turmas" de AL2 (BEAC-1864, story BEAC-1693 "Histórico de turmas do
 * aluno") — substitui o placeholder "Em breve" de StudentProfilePage.tsx
 * (BEAC-1871). Markup/copy lidos diretamente do protótipo real (Artifact
 * "Rallye — Pessoas & Turmas", seção `scr-al2`, `data-pp="turmas"`, arquivo
 * salvo em .claude/.../tool-results/artifact-bf7a3004-1783743726-dbe8.html
 * linhas ~820-825): `.ag-list` > `.p-row` (`.strip` cor do esporte + `.pw`
 * `.nm` nome + `.mt` "{dias} {horário} · Prof. {professor}") + chevron,
 * clicável -> T2 (`/units/{id}/classes/{classId}`, rota real já registrada em
 * App.tsx) + botão "Adicionar a turma".
 *
 * Consome GET /students/{id}/class-history (BEAC-1863, handler real lido em
 * rallye-api-beac1693/api/internal/classhistory/handler.go antes de escrever
 * ../../lib/api/classHistory.ts) — devolve TODAS as matrículas (ativas e
 * encerradas), ordenadas por enrolled_at DESC pelo próprio backend; `status`
 * 'ended' ganha um badge "Encerrada" (`.badge.b-muted`, já existente nesta
 * página) porque é um dado real do wire que a UI não deveria esconder — o
 * protótipo só mostra um exemplo de matrícula ativa (sem badge), então o
 * badge de encerrada é a extensão mínima e não-inventada para o caso real de
 * "histórico" que o protótipo não ilustrou.
 *
 * Botão "Adicionar a turma": exige write em 'alunos' E 'agenda' ao mesmo
 * tempo (interseção — mesmo AC do endpoint real que ele aciona, POST
 * /classes/{id}/enrollments, BEAC-1862/BEAC-1692, já implementado; ver
 * comentário de módulo de ../../lib/api/enrollments.ts) — "esconder sempre,
 * nunca desabilitar" (usePermission.ts, Épico 3), mesmo padrão já usado
 * pelas outras abas desta mesma tela (StudentProfilePage.tsx, canSeeFinance).
 */
export function ClassHistorySection({ unitId, studentId }: ClassHistorySectionProps) {
  const navigate = useNavigate()
  const canWriteStudents = usePermission('alunos', 'write')
  const canWriteAgenda = usePermission('agenda', 'write')
  const canEnroll = canWriteStudents && canWriteAgenda
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      listClassHistory(studentId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', items: result.classHistory })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [studentId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const activeClassIds = new Set(
    state.status === 'ready'
      ? state.items.filter((item) => item.status === 'active').map((item) => item.classId)
      : [],
  )

  return (
    <div className="ptab-panel">
      {state.status === 'loading' ? <PageLoading label="Carregando turmas" variant="list" rows={3} /> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar o histórico de turmas.</p>
      ) : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <p className="hint">Nenhuma matrícula encontrada.</p>
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <div className="ag-list">
          {state.items.map((item) => (
            <button
              type="button"
              key={item.enrollmentId}
              className="p-row"
              data-testid={`class-history-row-${item.enrollmentId}`}
              onClick={() => navigate(`/units/${unitId}/classes/${item.classId}`)}
            >
              <span className="strip" style={{ background: `var(${sportCssVar(item.sport)})` }} />
              <span className="pw">
                <span className="nm">
                  {item.className}
                  {item.status === 'ended' ? <Badge tone="neutral">Encerrada</Badge> : null}
                </span>
                <span className="mt">
                  {scheduleLabel(item)} · {teacherDisplay(item.teacherName)}
                </span>
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {canEnroll ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setSheetOpen(true)}
        >
          Adicionar a turma
        </button>
      ) : null}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Adicionar a turma">
        {sheetOpen ? (
          <AddToClassSheet
            unitId={unitId}
            studentId={studentId}
            excludeClassIds={activeClassIds}
            onEnrolled={() => {
              setSheetOpen(false)
              load(() => false)
            }}
            onClose={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </div>
  )
}
