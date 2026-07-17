import { type FormEvent, useState } from 'react'
import { createRole, patchRole, type Role, type RolePermissions } from '../../lib/api/roles'
import { MODULE_CATALOG } from './moduleCatalog'
import './RoleFormSheet.css'

export interface RoleFormSheetProps {
  unitId: string
  /** Presente = edição de um papel customizado existente (pré-preenchido);
   * ausente = criação (BEAC-1842's POST). Papéis de sistema nunca chegam
   * aqui — RolesPage não oferece nenhuma ação de edição para eles (ver
   * comentário em RolesPage.tsx). */
  role?: Role
  onSuccess: (role: Role) => void
  onCancel: () => void
}

function actionsToSet(actions: string[] | undefined): Set<string> {
  return new Set(actions ?? [])
}

function initialPermissionsState(role: Role | undefined): Record<string, Set<string>> {
  const state: Record<string, Set<string>> = {}
  for (const module of MODULE_CATALOG) {
    state[module.slug] = actionsToSet(role?.permissions[module.slug])
  }
  return state
}

function toPayload(state: Record<string, Set<string>>): RolePermissions {
  const payload: RolePermissions = {}
  for (const [module, actions] of Object.entries(state)) {
    if (actions.size > 0) payload[module] = [...actions].sort()
  }
  return payload
}

/**
 * Formulário de criação/edição de papel customizado (BEAC-1843's AC:
 * "'Criar papel' abre um formulário: nome + checklist dos 9 módulos, cada
 * um com toggle de leitura/escrita" e "tocar num papel customizado abre o
 * mesmo checklist pré-preenchido para edição"). O protótipo real (scr-c3)
 * não desenha essa tela — só referencia sua existência ("Tocar num
 * personalizado abre o checklist de permissões por módulo", hint-note da
 * C3) — então a estrutura do formulário em si segue os componentes já
 * existentes deste app (BottomSheet + padrão `.field`/`.stack` de
 * EnterArenaSheet), não uma tradução pixel-a-pixel de nenhuma seção do
 * protótipo.
 */
export function RoleFormSheet({ unitId, role, onSuccess, onCancel }: RoleFormSheetProps) {
  const isEdit = role !== undefined
  const [name, setName] = useState(role?.name ?? '')
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(() =>
    initialPermissionsState(role),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleAction(moduleSlug: string, action: string) {
    setPermissions((prev) => {
      const next = new Set(prev[moduleSlug])
      if (next.has(action)) next.delete(action)
      else next.add(action)
      return { ...prev, [moduleSlug]: next }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Nome é obrigatório')
      return
    }

    setSubmitting(true)
    setError(null)
    const payload = toPayload(permissions)
    const result =
      isEdit && role
        ? await patchRole(unitId, role.id, { name: trimmed, permissions: payload })
        : await createRole(unitId, { name: trimmed, permissions: payload })
    setSubmitting(false)

    if (!result.ok) {
      setError(
        result.status === 403
          ? 'Você não tem permissão para gerenciar papéis nesta arena.'
          : `Não foi possível salvar o papel (${result.error}).`,
      )
      return
    }

    onSuccess(result.role)
  }

  return (
    <div className="role-form-sheet">
      <h2>{isEdit ? 'Editar papel' : 'Criar papel'}</h2>

      <form onSubmit={handleSubmit} className="stack">
        <div className="field">
          <label htmlFor="role-name">Nome do papel</label>
          <input
            id="role-name"
            className="input"
            type="text"
            placeholder="Ex: Recepção"
            value={name}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="role-form-sheet__checklist-label">Permissões por módulo</span>
          <div className="role-module-checklist">
            {MODULE_CATALOG.map((module) => {
              const moduleActions = permissions[module.slug]
              return (
                <div className="role-module-row" key={module.slug}>
                  <span className="role-module-row__name">{module.label}</span>
                  <label className="role-module-row__toggle">
                    <input
                      type="checkbox"
                      checked={moduleActions.has('read')}
                      disabled={submitting}
                      onChange={() => toggleAction(module.slug, 'read')}
                    />
                    Ver
                  </label>
                  <label className="role-module-row__toggle">
                    <input
                      type="checkbox"
                      checked={moduleActions.has('write')}
                      disabled={submitting}
                      onChange={() => toggleAction(module.slug, 'write')}
                    />
                    Editar
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        {error ? (
          <p role="alert" className="role-form-sheet__feedback">
            {error}
          </p>
        ) : null}

        <div className="role-form-sheet__actions">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-md" disabled={submitting}>
            {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar papel'}
          </button>
        </div>
      </form>
    </div>
  )
}
