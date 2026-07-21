import { useState } from 'react'
import { patchRemuneration } from '../../lib/api/remuneration'
import type { RemunerationModel } from '../../lib/api/teachers'

type View = 'menu' | 'alterar-remuneracao'

export interface RemunerationSheetProps {
  teacherId: string
  currentModel: RemunerationModel
  currentValue: number
  onUpdated: (model: RemunerationModel, value: number) => void
  onClose: () => void
}

const MODEL_OPTIONS: { value: RemunerationModel; label: string }[] = [
  { value: 'fixed', label: 'Fixo mensal' },
  { value: 'per_class', label: 'Por aula' },
  { value: 'commission', label: 'Comissão (%)' },
]

/**
 * Conteúdo do BottomSheet [⚙️] de PR2 (BEAC-1880): AC pede um "menu simples
 * com só a ação 'Alterar remuneração'" — as demais ações do menu ⚙️ do doc
 * real (PR2, seção "Ações via [⚙️]": "Editar dados", "Atualizar
 * disponibilidade", "Relatório de performance", "Desativar professor") NÃO
 * são implementadas aqui: nenhum dos endpoints correspondentes existe
 * (PATCH /teachers/{id} genérico, endpoint de desativação, relatório de
 * performance) — fora de escopo desta task, ficam como follow-up futuro.
 * "Atualizar disponibilidade" já é editável diretamente na própria aba
 * Horários (AvailabilityGrid mode="edit" seria o caminho, não este menu —
 * mas PR2 usa mode="read", ver TeacherProfilePage.tsx), então nem faria
 * sentido duplicar aqui.
 *
 * Chama PATCH /teachers/{id}/remuneration (BEAC-1879, já implementado e
 * testado no backend, ver rallye-api/api/internal/remuneration/handler.go)
 * — SOMENTE Admin (professores:write), sem bypass de self.
 */
export function RemunerationSheet({
  teacherId,
  currentModel,
  currentValue,
  onUpdated,
  onClose,
}: RemunerationSheetProps) {
  const [view, setView] = useState<View>('menu')
  const [model, setModel] = useState<RemunerationModel>(currentModel)
  const [value, setValue] = useState(String(currentValue))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const numericValue = Number(value)
    setBusy(true)
    setError(null)
    const result = await patchRemuneration(teacherId, {
      remunerationModel: model,
      remunerationValue: numericValue,
    })
    setBusy(false)
    if (!result.ok) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    onUpdated(result.remunerationModel, result.remunerationValue)
  }

  if (view === 'menu') {
    return (
      <div className="settings-sheet">
        <div className="settings-sheet__head">
          <h2 className="sec-head-title">Ações</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="menu-list">
          <button
            type="button"
            className="role-row role-row--clickable"
            onClick={() => setView('alterar-remuneracao')}
          >
            <span className="rn">Alterar remuneração</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-sheet">
      <h2 className="sec-head-title">Alterar remuneração</h2>
      <label className="field">
        <span>Modelo</span>
        <select value={model} onChange={(e) => setModel(e.target.value as RemunerationModel)}>
          {MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{model === 'commission' ? 'Percentual (%)' : 'Valor (R$)'}</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
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
          disabled={busy || !value.trim() || Number(value) <= 0}
          onClick={() => void submit()}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
