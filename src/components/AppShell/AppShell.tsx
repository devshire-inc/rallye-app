import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import { useLongPress } from '../../hooks/useLongPress'
import { usePermission } from '../../hooks/usePermission'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getUnreadNotificationCount } from '../../lib/api/notifications'
import { N1_PATH, S1_PATH } from '../../lib/redirectTarget'
import { getActiveTenantId, getActiveUnitId } from '../../lib/tenantContext'
import './AppShell.css'

export interface AppShellProps {
  /** Rótulo de tenant/unit exibido no rodapé da sidebar (ex.: "Rede Areia
   * Dourada · 3 unidades"). */
  orgLabel: string
  /** Rótulo do usuário logado + papel (ex.: "Bruno Fernandes · Dono"). */
  userLabel: string
  children: ReactNode
}

interface NavItem {
  key: string
  label: string
  path: string
  visible: boolean
}

/** Rota da Agenda depende do role bruto de useShellIdentity (BEAC-2080) —
 * valores REAIS do seed (migrations/000016_seed_system_roles), 'Aluno'/
 * 'Professor' capitalizados, nunca lowercase. Qualquer outro role
 * (admin-tier ou null) cai na Agenda genérica. */
function agendaPathFor(unitId: string, role: string | null): string {
  if (role === 'Aluno') return `/units/${unitId}/agenda/minha`
  if (role === 'Professor') return `/units/${unitId}/agenda/professor`
  return `/units/${unitId}/agenda`
}

function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

/** Os 4 destinos de "Gestão" (BEAC-2087). Não existe módulo de permissão
 * dedicado por sub-item no catálogo real (src/lib/api/permissions.ts) além
 * de 'config' (módulo representativo das 4 telas administrativas) — os 3
 * primeiros, unit-scoped, usam a mesma `canConfig` do item pai "Gestão"
 * (redundante com o gate do pai, mas cada um também exige `unitId` real,
 * já que suas rotas são `/units/:unitId/...`). "Minhas unidades" é
 * tenant-scoped: exige `tenantId`, não `unitId`. */
function gestaoSubItemsFor(
  unitId: string | null,
  tenantId: string | null,
  canConfig: boolean,
): NavItem[] {
  return [
    {
      key: 'membros',
      label: 'Membros',
      path: unitId ? `/units/${unitId}/members` : '',
      visible: canConfig && unitId !== null,
    },
    {
      key: 'papeis',
      label: 'Papéis',
      path: unitId ? `/units/${unitId}/roles` : '',
      visible: canConfig && unitId !== null,
    },
    {
      key: 'config-arena',
      label: 'Configurações da arena',
      path: unitId ? `/units/${unitId}/settings` : '',
      visible: canConfig && unitId !== null,
    },
    {
      key: 'minhas-unidades',
      label: 'Minhas unidades',
      path: tenantId ? `/tenants/${tenantId}/units` : '',
      visible: canConfig && tenantId !== null,
    },
  ]
}

/**
 * Shell "PF3" (BEAC-1832) — sidebar (>=860px) + bottomnav (mobile) no
 * padrão `.app-shell`/`.sidebar`/`.bottomnav` do protótipo real. Navegação
 * real (BEAC-2058, task BEAC-2086): cada item é gated por `usePermission`
 * (ver ../../hooks/usePermission.ts, contrato "esconder sempre, nunca
 * desabilitar") e aponta pra uma rota real de src/App.tsx — substitui os
 * itens antes inertes/desabilitados. "Loja" foi removida inteiramente
 * (decisão travada de BEAC-2048, nenhuma rota existe). O item ativo é
 * calculado via prefix-match do path atual (useLocation), tanto na sidebar
 * quanto na bottomnav — as duas sempre renderizam no DOM, alternando-se só
 * por CSS (ver AppShell.css), então ambas recebem o mesmo item set.
 *
 * Topbar (BEAC-2021, story BEAC-1723): AppShell é hoje a shell mais próxima
 * de "qualquer tela" do app (~35 páginas já usam), então o sino da N1
 * (Central de Notificações) mora aqui, não numa página específica —
 * renderizado em AMBOS breakpoints (diferente de sidebar/bottomnav, que se
 * alternam por largura, ver AppShell.css), só com o sino + badge de
 * contagem alinhados à direita. O badge busca GET /me/notifications/
 * unread-count ao montar; falha é best-effort (badge só não aparece, sem
 * travar a tela).
 */
export function AppShell({ orgLabel, userLabel, children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // BEAC-1835: "Acessível via long-press no logo Rallye, de qualquer tela do
  // app" — cobre Perfil/OW2/OW3, as telas hospedadas por esta shell. Nota:
  // a sidebar (e este logo) só aparece em telas >=860px (ver AppShell.css) —
  // gap conhecido de cobertura mobile, não resolvido por esta task.
  const longPress = useLongPress(() => navigate(S1_PATH))
  const [unreadCount, setUnreadCount] = useState(0)
  const [gestaoOpen, setGestaoOpen] = useState(false)

  const { role } = useShellIdentity()
  const unitId = getActiveUnitId()
  const tenantId = getActiveTenantId()
  const canAgenda = usePermission('agenda', 'read')
  const canTorneios = usePermission('torneios', 'read')
  const canRelatorios = usePermission('relatorios', 'read')
  const canConfig = usePermission('config', 'read')

  useEffect(() => {
    let cancelled = false
    getUnreadNotificationCount()
      .then((result) => {
        if (!cancelled && result.ok) setUnreadCount(result.unreadCount)
      })
      .catch(() => {
        // best-effort — ver comentário de pacote acima.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const navItems: NavItem[] = [
    {
      key: 'inicio',
      label: 'Início',
      path: unitId ? `/units/${unitId}/dashboard` : '/dashboard',
      visible: true,
    },
    {
      key: 'agenda',
      label: 'Agenda',
      path: unitId ? agendaPathFor(unitId, role) : '',
      visible: canAgenda && unitId !== null,
    },
    {
      key: 'torneios',
      label: 'Torneios',
      path: unitId ? `/units/${unitId}/tournaments` : '',
      visible: canTorneios && unitId !== null,
    },
    {
      key: 'relatorios',
      label: 'Relatórios',
      path: unitId ? `/units/${unitId}/reports` : '',
      visible: canRelatorios && unitId !== null,
    },
    {
      key: 'perfil',
      label: 'Perfil',
      path: '/perfil',
      visible: true,
    },
  ]
  const visibleNavItems = navItems.filter((item) => item.visible)

  const visibleGestaoSubItems = gestaoSubItemsFor(unitId, tenantId, canConfig).filter(
    (item) => item.visible,
  )
  const gestaoActive = visibleGestaoSubItems.some((item) => isActivePath(location.pathname, item.path))

  function navigateToGestaoItem(path: string) {
    navigate(path)
    setGestaoOpen(false)
  }

  return (
    <div className="app-shell">
      <div className="shell-topbar">
        <button
          type="button"
          className="shell-bell"
          aria-label="Notificações"
          onClick={() => navigate(N1_PATH)}
        >
          🔔
          {unreadCount > 0 && (
            <span className="shell-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>
      <div className="shell-body">
        <aside className="sidebar">
          <div className="brand-mark brand-mark--pressable" {...longPress}>
            rallye<span className="dot">.</span>
          </div>
          {visibleNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`side-item${isActivePath(location.pathname, item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
          {canConfig && (
            <>
              <div className="side-sep" />
              <div className="side-gestao">
                <button
                  type="button"
                  className={`side-item${gestaoActive ? ' active' : ''}`}
                  onClick={() => setGestaoOpen((open) => !open)}
                >
                  Gestão
                </button>
                {gestaoOpen && (
                  <div className="side-gestao-menu" role="menu">
                    {visibleGestaoSubItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        className="side-gestao-menu-item"
                        onClick={() => navigateToGestaoItem(item.path)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="side-foot">
            {orgLabel}
            <br />
            {userLabel}
          </div>
        </aside>
        <div className="shell-main">{children}</div>
      </div>
      <nav className="bottomnav">
        {visibleNavItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`bn-item${isActivePath(location.pathname, item.path) ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        {canConfig && (
          <button
            type="button"
            className={`bn-item${gestaoActive ? ' active' : ''}`}
            onClick={() => setGestaoOpen((open) => !open)}
          >
            Gestão
          </button>
        )}
      </nav>
      {canConfig && (
        <div className="gestao-sheet-wrapper">
          <BottomSheet open={gestaoOpen} onClose={() => setGestaoOpen(false)} label="Gestão">
            <div className="gestao-sheet">
              {visibleGestaoSubItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="gestao-sheet-item"
                  onClick={() => navigateToGestaoItem(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </BottomSheet>
        </div>
      )}
    </div>
  )
}
