import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { listRoles, type Role } from '../../lib/api/roles'
import { permissionSummary } from './moduleCatalog'
import { RoleFormSheet } from './RoleFormSheet'
import RoleAuditPanel from '../RoleAudit/RoleAuditPanel'
import '../../components/AuthLayout/AuthLayout.css'
import './RolesPage.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; roles: Role[] }

type Tab = 'papeis' | 'historico'

/** Nenhum sheet aberto, o form de criação, ou o form de edição de um
 * customizado específico — nunca de um role de sistema (RolesPage não
 * oferece essa ação, ver comentário abaixo). */
type SheetState = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; role: Role }

// Exact copy locked by the C3 prototype (scr-c3, artifact "Rallye — Perfil &
// Config · Saque Noturno") — do not paraphrase.
const NEUTRAL_TOAST_TEXT =
  'Permissões granulares em 9 módulos: alunos, professores, agenda, financeiro, torneios, loja, config, relatórios e quadras. 1 papel por pessoa por arena.'
const HINT_NOTE_TEXT =
  'Papéis personalizados são da arena (não vazam pra outras). Tocar num personalizado abre o checklist de permissões por módulo. Toda mudança de papel/permissão fica no Histórico: quem, quando, antes/depois.'
const HISTORICO_HINT_NOTE_TEXT =
  'Registro de auditoria imutável — sem edição ou exclusão, nesta tela ou em qualquer outra.'

/**
 * C3 — Papéis e permissões (BEAC-1843/BEAC-1848, stories BEAC-1684 e
 * BEAC-1687). Markup segue scr-c3 do protótipo real (Artifact "Rallye —
 * Perfil & Config · Saque Noturno",
 * `claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5`): cabeçalho
 * com botão "Criar papel", tabs Papéis/Histórico, seção "Papéis do sistema
 * (imutáveis)" e "Papéis personalizados". A aba Histórico renderiza
 * RoleAuditPanel (BEAC-1848) — conteúdo real, não mais um placeholder: as
 * duas abas foram construídas em branches isolados (BEAC-1684/BEAC-1687,
 * cada um sem visibilidade do outro) e reconciliadas aqui na integração do
 * épico, exatamente como o protótipo sempre desenhou — uma tela só, duas
 * abas.
 *
 * Rota `/units/:unitId/roles` (não `/tenants/:tenantId/...` como OW2/OW3):
 * o endpoint que esta tela consome (BEAC-1842) é unit-scoped por `{id}` no
 * path, não tenant-scoped — mesma forma, refletida na rota do frontend.
 */
export default function RolesPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('papeis')
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })

  // unitId ausente vira uma promise rejeitada só para o setState acontecer
  // dentro do mesmo `.catch` do caminho normal, nunca sincronamente dentro
  // do corpo do efeito (react-hooks/set-state-in-effect — mesmo padrão de
  // loadInitial em S1Page.tsx, que nunca tem esse branch síncrono porque
  // sempre tem uma sessão válida antes de chamar a API).
  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = unitId ? listRoles(unitId) : Promise.reject(new Error('missing_unit_id'))
      request
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

  function handleSheetSuccess() {
    setSheet({ kind: 'closed' })
    load(() => false)
  }

  const roles = state.status === 'ready' ? state.roles : []
  const systemRoles = roles.filter((r) => r.isSystemRole)
  const customRoles = roles.filter((r) => !r.isSystemRole)

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to="/perfil">
          ‹ Perfil
        </Link>
        <h1>Papéis e permissões</h1>
        <div className="spacer" />
        {unitId ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setSheet({ kind: 'create' })}
          >
            + Criar papel
          </button>
        ) : null}
      </div>

      <div className="ptabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'papeis'}
          className={tab === 'papeis' ? 'active' : ''}
          onClick={() => setTab('papeis')}
        >
          Papéis
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'historico'}
          className={tab === 'historico' ? 'active' : ''}
          onClick={() => setTab('historico')}
        >
          Histórico
        </button>
      </div>

      <div className="dash-body">
        {tab === 'papeis' ? (
          <div className="ptab-panel">
            {state.status === 'loading' ? (
              <p role="status">Carregando papéis…</p>
            ) : state.status === 'error' ? (
              <p role="alert">Não foi possível carregar os papéis desta arena.</p>
            ) : (
              <>
                <div className="set-title" style={{ marginTop: 0 }}>
                  Papéis do sistema (imutáveis)
                </div>
                <div className="menu-list">
                  {systemRoles.map((role) => (
                    // Papel de sistema: sem onClick, sem chevron — "tocar num
                    // papel de sistema não oferece nenhuma ação de edição"
                    // (AC). Esconder sempre, nunca desabilitar (regra de ouro
                    // do épico) — aqui não há elemento nenhum de edição a
                    // esconder: a linha inteira simplesmente não é clicável.
                    <div className="role-row" key={role.id}>
                      <div className="role-row__icon">{role.name.slice(0, 1).toUpperCase()}</div>
                      <div className="role-row__body">
                        <div className="rn">{role.name}</div>
                        <div className="rm">{permissionSummary(role.permissions)}</div>
                      </div>
                      <Badge tone="neutral">Sistema</Badge>
                    </div>
                  ))}
                </div>

                <div className="set-title">Papéis personalizados</div>
                <div className="menu-list">
                  {customRoles.length === 0 ? (
                    <p className="hint" style={{ padding: 'var(--space-3)' }}>
                      Nenhum papel personalizado criado ainda nesta arena.
                    </p>
                  ) : (
                    customRoles.map((role) => (
                      <button
                        type="button"
                        className="role-row role-row--clickable"
                        key={role.id}
                        onClick={() => setSheet({ kind: 'edit', role })}
                      >
                        <div className="role-row__icon">{role.name.slice(0, 1).toUpperCase()}</div>
                        <div className="role-row__body">
                          <div className="rn">{role.name}</div>
                          <div className="rm">{permissionSummary(role.permissions)}</div>
                        </div>
                        <span className="chev">›</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Nota: não usa a classe genérica ".toast" (definida em
                    components/Toast.css como banner fixo/dismissível, um
                    componente diferente já usado por Login/Signup/Reset) —
                    colidiria (position:fixed) com o banner inline do
                    protótipo aqui. ".toast-neutral" sozinha carrega todo o
                    estilo necessário (ver RolesPage.css). */}
                <div className="toast-neutral">{NEUTRAL_TOAST_TEXT}</div>
              </>
            )}
          </div>
        ) : (
          <div className="ptab-panel">
            <RoleAuditPanel unitId={unitId} />
          </div>
        )}
      </div>

      <p className="hint-note">{tab === 'papeis' ? HINT_NOTE_TEXT : HISTORICO_HINT_NOTE_TEXT}</p>

      <BottomSheet
        open={sheet.kind !== 'closed'}
        onClose={() => setSheet({ kind: 'closed' })}
        label={sheet.kind === 'edit' ? 'Editar papel' : 'Criar papel'}
      >
        {sheet.kind !== 'closed' && unitId ? (
          <RoleFormSheet
            unitId={unitId}
            role={sheet.kind === 'edit' ? sheet.role : undefined}
            onSuccess={handleSheetSuccess}
            onCancel={() => setSheet({ kind: 'closed' })}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
