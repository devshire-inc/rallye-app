import { useEffect, useState } from 'react'
import { decideTeacherBlockRequest, type PendingApprovalItem } from '../lib/api/pendingApprovals'
import { listTeachers, type TeacherListItem } from '../lib/api/teachers'

type View = 'menu' | 'substitute-picker'

export interface BlockRequestDecisionSheetProps {
  unitId: string
  item: PendingApprovalItem
  onDecided: () => void
  onClose: () => void
}

/**
 * BEAC-1894 (story BEAC-1703): passo intermediário quando o admin clica
 * "Aprovar" num item type=teacher_block do card de Pendências — abre um
 * bottom sheet com "Cancelar aula(s)" e "Substituir professor" (reaproveita
 * BottomSheet, mesmo padrão de RemunerationSheet.tsx). Admin SEMPRE vê
 * "Cancelar aula(s)", mesmo com um substituto em mente (AC).
 *
 * ## Picker de professores
 *
 * Nenhum componente de picker genérico existe nesta base (grep
 * confirmado) — versão mínima documentada no AC: um `<select>` simples
 * listando os professores da unit (GET /units/{id}/teachers, já existe),
 * excluindo o próprio professor bloqueado.
 *
 * Sem protótipo pixel-a-pixel para este sub-fluxo (o protótipo demo só
 * mostra aprovar/recusar genérico de 1 clique) — a ramificação
 * cancelar-vs-substituir é uma decisão de UI desta task.
 */
export function BlockRequestDecisionSheet({
  unitId,
  item,
  onDecided,
  onClose,
}: BlockRequestDecisionSheetProps) {
  const [view, setView] = useState<View>('menu')
  const [teachers, setTeachers] = useState<TeacherListItem[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (view !== 'substitute-picker') return
    let cancelled = false
    listTeachers(unitId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setTeachers(result.teachers.filter((t) => t.id !== item.teacherBlock?.teacherId))
      }
    })
    return () => {
      cancelled = true
    }
  }, [view, unitId, item.teacherBlock?.teacherId])

  async function confirmCancel() {
    setBusy(true)
    setError(null)
    const result = await decideTeacherBlockRequest(item.id, 'approve_cancel')
    setBusy(false)
    if (!result.ok) {
      setError('Não foi possível cancelar as aulas. Tente novamente.')
      return
    }
    onDecided()
  }

  async function confirmSubstitute() {
    if (!selectedTeacherId) return
    setBusy(true)
    setError(null)
    const result = await decideTeacherBlockRequest(item.id, 'approve_substitute', selectedTeacherId)
    setBusy(false)
    if (!result.ok) {
      setError('Não foi possível confirmar o substituto. Tente novamente.')
      return
    }
    onDecided()
  }

  if (!item.teacherBlock) return null
  const { teacherName, reason } = item.teacherBlock

  if (view === 'menu') {
    return (
      <div className="settings-sheet">
        <div className="settings-sheet__head">
          <h2 className="sec-head-title">Bloqueio de horário · {teacherName}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="hint">{reason}</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="menu-list">
          <button
            type="button"
            className="role-row role-row--clickable"
            disabled={busy}
            onClick={() => void confirmCancel()}
          >
            <span className="rn">Cancelar aula(s)</span>
          </button>
          <button
            type="button"
            className="role-row role-row--clickable"
            disabled={busy}
            onClick={() => setView('substitute-picker')}
          >
            <span className="rn">Substituir professor</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-sheet">
      <h2 className="sec-head-title">Substituir professor</h2>
      <label className="field">
        <span>Professor substituto</span>
        <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
          <option value="">Selecione…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setView('menu')}
          disabled={busy}
        >
          Voltar
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !selectedTeacherId}
          onClick={() => void confirmSubstitute()}
        >
          Confirmar substituição
        </button>
      </div>
    </div>
  )
}
