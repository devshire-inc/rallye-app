import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import { BottomNav, type BottomNavItem } from '../ui/BottomNav/BottomNav'
import { BrandLogo } from '../ui/Icon/BrandLogo'
import { Icon } from '../ui/Icon/Icon'
import { IconButton } from '../ui/IconButton/IconButton'
import { Sidebar, type SidebarNavItem, type SidebarSection } from '../ui/Sidebar/Sidebar'
import { useLongPress } from '../../hooks/useLongPress'
import { usePermission } from '../../hooks/usePermission'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getUnreadNotificationCount } from '../../lib/api/notifications'
import { N1_PATH, S1_PATH, TROCAR_ARENA_PATH } from '../../lib/redirectTarget'
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

/** Mapeia cada NavItem pro ícone correspondente — mesmo dicionário de nomes
 * (BEAC-2091) reutilizado tanto pelo `BottomNav` real (mobile) quanto pelo
 * `Sidebar` real (desktop, reskin desta task). 'bar-chart'/'briefcase' foram
 * adicionados ao `ICON_PATHS` do `BottomNav` especificamente pra
 * Relatórios/Gestão; 'trophy'/'bar-chart' foram replicados no `ICON_PATHS`
 * do `Sidebar` pelo mesmo motivo (ver comentário em cada componente). */
const NAV_ICON_BY_KEY: Record<string, string> = {
  inicio: 'home',
  agenda: 'calendar',
  torneios: 'trophy',
  relatorios: 'bar-chart',
  perfil: 'user',
}

/** Ícone por sub-item de "Gestão" — dicionário do `Sidebar` real (ver
 * ../ui/Sidebar/Sidebar.tsx) não tem um ícone dedicado por destino
 * administrativo; reaproveita os mais próximos semanticamente já
 * disponíveis lá. */
const GESTAO_ICON_BY_KEY: Record<string, string> = {
  membros: 'users',
  papeis: 'user-circle',
  'config-arena': 'settings',
  'minhas-unidades': 'briefcase',
}

/** Iniciais (até 2 letras) pro avatar redondo do seletor de arena no rodapé
 * da sidebar (Figma node 152:5169 "Avatar") — não há foto de arena no
 * catálogo real, só o rótulo textual já recebido via `orgLabel`. */
function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
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
 * Shell "PF3" (BEAC-1832) — `Sidebar` real (>=860px, componente da Fundação,
 * reskin desta task) + `BottomNav` real (mobile, componente da Fundação
 * desde BEAC-2091) no padrão `.app-shell`/`.shell-sidebar-wrapper`/
 * `.shell-bottomnav-wrapper`. Navegação real (BEAC-2058, task BEAC-2086):
 * cada item é gated por `usePermission` (ver ../../hooks/usePermission.ts,
 * contrato "esconder sempre, nunca desabilitar") e aponta pra uma rota real
 * de src/App.tsx — substitui os itens antes inertes/desabilitados. "Loja"
 * foi removida inteiramente (decisão travada de BEAC-2048, nenhuma rota
 * existe). O item ativo é calculado via prefix-match do path atual
 * (useLocation); `Sidebar` e `BottomNav` recebem cada um seu próprio
 * `active` (label) equivalente — ambos sempre renderizam no DOM,
 * alternando-se só por CSS (ver AppShell.css), então recebem o mesmo item
 * set (mapeado pra `sections`/`footerItems` na sidebar, ver comentário de
 * pacote acima de `sidebarSections`).
 *
 * Topbar (BEAC-2021, story BEAC-1723): AppShell é hoje a shell mais próxima
 * de "qualquer tela" do app (~35 páginas já usam), então o sino da N1
 * (Central de Notificações) mora aqui, não numa página específica —
 * renderizado em AMBOS breakpoints (diferente de sidebar/bottomnav, que se
 * alternam por largura, ver AppShell.css), como `IconButton` ghost +
 * `Icon name="bell"` (reskin desta task — DS ainda não tem um composto
 * ícone+badge pronto, ver `.shell-bell-badge` em AppShell.css) + badge de
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

  const { role, loading: identityLoading } = useShellIdentity()
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
      // Enquanto a identidade não resolve, `role` é null e `agendaPathFor`
      // mandaria um Aluno/Professor pra Agenda genérica — rota errada. Mesma
      // postura fail-closed de `usePermission` (que também esconde itens
      // antes do primeiro fetch): o item só aparece quando o destino é o
      // definitivo.
      visible: canAgenda && unitId !== null && !identityLoading,
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
  const showGestao = canConfig && visibleGestaoSubItems.length > 0

  function navigateToGestaoItem(path: string) {
    navigate(path)
    setGestaoOpen(false)
  }

  // Sidebar real (desktop, ver ../ui/Sidebar/Sidebar.tsx): API é `sections`
  // (grupos com rótulo overline) + `footerItems`, sem suporte a dropdown
  // aninhado — diferente do antigo markup próprio, que abria "Gestão" num
  // popover. Mapeamento Figma (node 100:1238): "Gestão" vira sua própria
  // seção "GESTÃO" com os 4 destinos direto (mesmo padrão do
  // `DEFAULT_SECTIONS` do componente), e "Perfil" sai da seção principal
  // pro rodapé, ao lado do seletor de arena — a dropdown/`gestaoOpen` segue
  // existindo só pro `BottomSheet` do mobile (ver render abaixo).
  const sidebarMainItems = visibleNavItems.filter((item) => item.key !== 'perfil')
  const sidebarPerfilItem = visibleNavItems.find((item) => item.key === 'perfil')

  const sidebarSections: SidebarSection[] = [
    {
      label: 'PRINCIPAL',
      items: sidebarMainItems.map((item) => ({ icon: NAV_ICON_BY_KEY[item.key] ?? 'home', label: item.label })),
    },
    ...(showGestao
      ? [
          {
            label: 'GESTÃO',
            items: visibleGestaoSubItems.map((item) => ({
              icon: GESTAO_ICON_BY_KEY[item.key] ?? 'settings',
              label: item.label,
            })),
          },
        ]
      : []),
  ]

  const sidebarFooterItems: SidebarNavItem[] = sidebarPerfilItem
    ? [{ icon: 'user-circle', label: sidebarPerfilItem.label }]
    : []

  const sidebarPathByLabel = new Map<string, string>([
    ...visibleNavItems.map((item) => [item.label, item.path] as const),
    ...visibleGestaoSubItems.map((item) => [item.label, item.path] as const),
  ])

  const activeSidebarLabel =
    visibleNavItems.find((item) => isActivePath(location.pathname, item.path))?.label ??
    visibleGestaoSubItems.find((item) => isActivePath(location.pathname, item.path))?.label

  function handleSidebarChange(label: string) {
    const path = sidebarPathByLabel.get(label)
    if (path) navigate(path)
  }

  // BEAC-2091: mesmo item set da sidebar, mapeado pro contrato do `BottomNav`
  // real (`{icon,label}`) — nunca os `DEFAULT_ITEMS` do próprio componente
  // (que ainda incluem "Loja"). "Gestão" não é alvo de navegação direta, por
  // isso é tratada à parte no `onChange` abaixo em vez de virar mais um
  // `NavItem` comum.
  const bottomNavItems: BottomNavItem[] = [
    ...visibleNavItems.map((item) => ({ icon: NAV_ICON_BY_KEY[item.key] ?? 'home', label: item.label })),
    ...(showGestao ? [{ icon: 'briefcase', label: 'Gestão' }] : []),
  ]
  const activeBottomNavItem = visibleNavItems.find((item) => isActivePath(location.pathname, item.path))
  const activeBottomNavLabel = activeBottomNavItem?.label ?? (gestaoActive ? 'Gestão' : undefined)

  function handleBottomNavChange(label: string) {
    if (label === 'Gestão') {
      setGestaoOpen((open) => !open)
      return
    }
    const item = visibleNavItems.find((navItem) => navItem.label === label)
    if (item) navigate(item.path)
  }

  return (
    <div className="app-shell">
      <div className="shell-topbar">
        <div className="shell-bell-wrapper">
          <IconButton variant="ghost" size="md" label="Notificações" onClick={() => navigate(N1_PATH)}>
            <Icon name="bell" />
          </IconButton>
          {unreadCount > 0 && (
            <span className="shell-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      </div>
      <div className="shell-body">
        <div className="shell-sidebar-wrapper">
          <Sidebar
            logo={
              <div className="shell-sidebar-logo shell-sidebar-logo--pressable" {...longPress}>
                <BrandLogo name="rallye-mark" variant="dark" size={24} />
                <span>
                  rallye<span className="dot">.</span>
                </span>
              </div>
            }
            sections={sidebarSections}
            footerItems={sidebarFooterItems}
            arenaSelector={{
              label: orgLabel,
              action: userLabel,
              avatar: <span className="shell-sidebar-avatar-initials">{initialsOf(orgLabel)}</span>,
              onClick: () => navigate(TROCAR_ARENA_PATH),
            }}
            active={activeSidebarLabel}
            onChange={handleSidebarChange}
          />
        </div>
        <div className="shell-main">{children}</div>
      </div>
      <div className="shell-bottomnav-wrapper">
        <BottomNav items={bottomNavItems} active={activeBottomNavLabel} onChange={handleBottomNavChange} />
      </div>
      {canConfig && visibleGestaoSubItems.length > 0 && (
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
