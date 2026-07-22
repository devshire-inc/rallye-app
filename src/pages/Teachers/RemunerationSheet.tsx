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
  /** BEAC-1875 (PR3 modo editar): quando informado, adiciona "Editar dados"
   * ao menu — navega para PR3 em modo edição (nome/telefone/esportes/
   * certificações/bio). Opcional para não quebrar nenhum outro chamador que
   * ainda não tenha essa rota disponível. */
  onEditData?: () => void
}

const MODEL_OPTIONS: { value: RemunerationModel; label: string }[] = [
  { value: 'fixed', label: 'Fixo mensal' },
  { value: 'per_class', label: 'Por aula' },
  { value: 'commission', label: 'Comissão (%)' },
]

/**
 * Conteúdo do BottomSheet [⚙️] de PR2. O AC original de BEAC-1880 pedia um
 * "menu simples com só a ação 'Alterar remuneração'" porque, na época,
 * nenhum outro endpoint do menu ⚙️ do doc real (PR2, seção "Ações via [⚙️]":
 * "Editar dados", "Atualizar disponibilidade", "Relatório de performance",
 * "Desativar professor") existia. BEAC-1875 resolveu "Editar dados" (PATCH
 * /teachers/{id} genérico, ver rallye-api/api/internal/teachers/
 * patch_handler.go) — item adicionado condicionalmente via `onEditData`
 * (prop opcional, ver comentário de RemunerationSheetProps). "Atualizar
 * disponibilidade", "Relatório de performance" e "Desativar professor"
 * continuam fora de escopo (sem endpoint correspondente) — "Atualizar
 * disponibilidade" já é editável diretamente na própria aba Horários da
 * PR3/PR2 em modo edição (AvailabilityGrid mode="edit"), não precisa de
 * duplicação aqui.
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
  onEditData,
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
          {onEditData ? (
            <button type="button" className="role-row role-row--clickable" onClick={onEditData}>
              <span className="rn">Editar dados</span>
            </button>
          ) : null}
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
