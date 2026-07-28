import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge/Badge'
import { listRoles, type Role } from '../../lib/api/roles'
import { patchMemberRole, type Member } from '../../lib/api/members'
import './MembersPage.css'

export interface RolePickerSheetProps {
  unitId: string
  member: Member
  onSuccess: (member: Member) => void
  onCancel: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; roles: Role[] }

/**
 * Conteúdo do BottomSheet aberto ao tocar num membro (BEAC-1845's AC:
 * "Tocar num membro abre um seletor de papel ... com os papeis disponíveis
 * daquela unit (sistema + customizados)"). Reaproveita o mesmo padrão visual
 * de linha de papel já estabelecido por BEAC-1684's RolesPage/`.role-row`
 * (distinção Sistema vs. customizado via badge "Sistema") — ver
 * MembersPage.css e o comentário de pacote em MembersPage.tsx sobre os dois
 * Artifacts reais lidos para esta story.
 */
export function RolePickerSheet({ unitId, member, onSuccess, onCancel }: RolePickerSheetProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [applyingRoleId, setApplyingRoleId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      listRoles(unitId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', roles: result.roles })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handlePick(role: Role) {
    if (applyingRoleId !== null) return
    setError(null)
    setApplyingRoleId(role.id)
    const result = await patchMemberRole(unitId, member.membershipId, role.id)
    setApplyingRoleId(null)
    if (!result.ok) {
      setError('Não foi possível trocar o papel agora. Tente novamente.')
      return
    }
    onSuccess(result.member)
  }

  return (
    <div className="role-picker">
      <div className="role-picker__head">
        <div className="nm">{member.user.name}</div>
        <div className="mt">Papel atual: {member.role?.name ?? 'Nenhum'}</div>
      </div>

      {state.status === 'loading' ? <p role="status">Carregando papéis…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar os papéis desta arena.</p>
      ) : null}

      {state.status === 'ready' ? (
        <div className="menu-list" role="listbox" aria-label="Selecionar papel">
          {state.roles.map((role) => (
            <button
              type="button"
              key={role.id}
              className="role-row role-row--clickable"
              role="option"
              aria-selected={member.role?.id === role.id}
              disabled={applyingRoleId !== null}
              onClick={() => handlePick(role)}
            >
              <div style={{ flex: 1 }}>
                <div className="rn">{role.name}</div>
              </div>
              {role.isSystemRole ? <Badge tone="neutral">Sistema</Badge> : null}
              {applyingRoleId === role.id ? <span className="hint">aplicando…</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}
