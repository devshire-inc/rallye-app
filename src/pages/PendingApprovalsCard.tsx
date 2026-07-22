import { useCallback, useEffect, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet/BottomSheet'
import { usePermission } from '../hooks/usePermission'
import {
  decideRescheduleCredit,
  decideTeacherBlockRequest,
  listPendingApprovals,
  type PendingApprovalItem,
} from '../lib/api/pendingApprovals'
import { BlockRequestDecisionSheet } from './BlockRequestDecisionSheet'
// .settings-sheet/.menu-list/.role-row/.sheet-actions (usados pelo bottom
// sheet de decisão) vivem em TeacherProfilePage.css — reaproveitados aqui
// via import, mesmo padrão de compartilhamento de CSS genérico entre
// páginas já usado por NewStudentPage.tsx (importa NewUnitPage.css).
import './Teachers/TeacherProfilePage.css'
import './PendingApprovalsCard.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: PendingApprovalItem[] }

function formatPeriod(startDate: string, endDate: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${fmt(startDate)} – ${fmt(endDate)}`
}

function formatTargetDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Card "Central de Pendências" do D3 (BEAC-1893, story BEAC-1703). Markup/
 * copy lidos diretamente do protótipo real (Artifact "Rallye —
 * Dashboards", seção `scr-d3`, `.pend-card`/`#pendToggle`/`.pend-item`):
 * header colapsável com badge numérico, corpo com lista de itens, ícone por
 * tipo (calendário para reschedule, alerta-triângulo para teacher_block),
 * "Recusar"/"Aprovar" por item.
 *
 * Gated por permission read em 'agenda' OU 'professores' (esconder o card
 * inteiro, nunca desabilitar) — mesmo espírito de "sempre ESCONDER quem não
 * tem permissão". Some inteiro quando não há pendências (AC).
 *
 * "Aprovar" num item teacher_block abre BlockRequestDecisionSheet
 * (BEAC-1894, cancelar-vs-substituir); "Aprovar"/"Recusar" num item
 * reschedule é 1 clique direto (PATCH /reschedule-credits/{id} — endpoint
 * novo desta dispatch, ver comentário de pacote de
 * src/lib/api/pendingApprovals.ts). "Recusar" de um item teacher_block
 * também é 1 clique direto.
 *
 * Gap conhecido, aceito (BEAC-1893 AC "aparece também na visão D3-F"): D3-F
 * (Dashboard filtrado por papel customizado/Funcionário) não existe como
 * tela própria neste código-fonte — só o D3 genérico (unit-scoped) foi
 * construído. Este card já é gated por permission (funcionaria em qualquer
 * contexto que o renderizasse), mas não há hoje uma rota/experiência D3-F
 * separada para renderizá-lo — fora de escopo desta dispatch.
 */
export function PendingApprovalsCard({ unitId }: { unitId: string }) {
  const canViewAgenda = usePermission('agenda', 'read')
  const canViewProfessores = usePermission('professores', 'read')
  const canView = canViewAgenda || canViewProfessores
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [open, setOpen] = useState(false)
  const [decidingBlockItem, setDecidingBlockItem] = useState<PendingApprovalItem | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!canView) return
    listPendingApprovals(unitId, 'pending').then((result) => {
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', items: result.items })
    })
  }, [unitId, canView])

  useEffect(() => {
    load()
  }, [load])

  if (!canView) return null
  if (state.status === 'loading' || state.status === 'error') return null
  if (state.items.length === 0) return null

  function removeItem(id: string) {
    setState((prev) => (prev.status === 'ready' ? { status: 'ready', items: prev.items.filter((i) => i.id !== id) } : prev))
  }

  async function handleRescheduleDecision(item: PendingApprovalItem, decision: 'approve' | 'reject') {
    setBusyItemId(item.id)
    const result = await decideRescheduleCredit(item.id, decision)
    setBusyItemId(null)
    if (result.ok) removeItem(item.id)
  }

  async function handleBlockRejection(item: PendingApprovalItem) {
    setBusyItemId(item.id)
    const result = await decideTeacherBlockRequest(item.id, 'reject')
    setBusyItemId(null)
    if (result.ok) removeItem(item.id)
  }

  return (
    <div className="pend-card">
      <div
        className="pend-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <span aria-hidden="true">🕐</span>
        <h3>Central de Pendências</h3>
        <span className="pbdg">{state.items.length}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </div>
      <div className={open ? 'pend-body open' : 'pend-body'}>
        {state.items.map((item) => (
          <div className="pend-item" key={item.id}>
            <span className="pi" aria-hidden="true">
              {item.type === 'reschedule' ? '📅' : '⚠️'}
            </span>
            <div className="pw">
              {item.type === 'reschedule' && item.reschedule ? (
                <>
                  <div className="pt">Remarcação · {item.reschedule.studentName}</div>
                  <div className="pd">
                    quer remarcar para {item.reschedule.targetClassName ?? 'turma'} ·{' '}
                    {formatTargetDateTime(item.reschedule.targetStartAt)}
                  </div>
                </>
              ) : null}
              {item.type === 'teacher_block' && item.teacherBlock ? (
                <>
                  <div className="pt">Bloqueio de horário · Prof. {item.teacherBlock.teacherName}</div>
                  <div className="pd">
                    indisponível {formatPeriod(item.teacherBlock.startDate, item.teacherBlock.endDate)} ·{' '}
                    {item.teacherBlock.reason}
                  </div>
                </>
              ) : null}
            </div>
            <div className="pacts">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busyItemId === item.id}
                onClick={() =>
                  item.type === 'reschedule'
                    ? void handleRescheduleDecision(item, 'reject')
                    : void handleBlockRejection(item)
                }
              >
                Recusar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busyItemId === item.id}
                onClick={() =>
                  item.type === 'reschedule'
                    ? void handleRescheduleDecision(item, 'approve')
                    : setDecidingBlockItem(item)
                }
              >
                Aprovar
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomSheet
        open={decidingBlockItem !== null}
        onClose={() => setDecidingBlockItem(null)}
        label="Decisão de bloqueio"
      >
        {decidingBlockItem ? (
          <BlockRequestDecisionSheet
            unitId={unitId}
            item={decidingBlockItem}
            onDecided={() => {
              removeItem(decidingBlockItem.id)
              setDecidingBlockItem(null)
            }}
            onClose={() => setDecidingBlockItem(null)}
          />
        ) : null}
      </BottomSheet>
    </div>
  )
}
