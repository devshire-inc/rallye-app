import type { ReactNode } from 'react'
import './Sidebar.css'

export interface SidebarNavItem {
  icon: string
  label: string
}

export interface SidebarSection {
  label: string
  items: SidebarNavItem[]
}

export interface SidebarArenaSelector {
  label: string
  action: string
  avatar?: ReactNode
  onClick?: () => void
}

export interface SidebarProps {
  logo?: ReactNode
  sections?: SidebarSection[]
  footerItems?: SidebarNavItem[]
  arenaSelector?: SidebarArenaSelector
  active?: string
  onChange?: (label: string) => void
}

const ICON_PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  user: 'M20 21a8 8 0 00-16 0M12 13a4 4 0 100-8 4 4 0 000 8z',
  briefcase: 'M3 8a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1zM9 7V6a2 2 0 012-2h2a2 2 0 012 2v1M3 13h18',
  // BEAC-2056+: sem Code Connect vetado para estes três (mesma situação do
  // bar-chart/briefcase do BottomNav) — path desenhado à mão no estilo
  // outline 24x24/stroke-1.8 já usado nos demais ícones deste dicionário.
  users: 'M17 21v-2a4 4 0 00-3-3.87M7 21v-2a4 4 0 013-3.87M13 7a4 4 0 11-8 0 4 4 0 018 0zM21 21v-2a4 4 0 00-3-3.85M16 3.13a4 4 0 010 7.75',
  // Reskin do AppShell: Torneios/Relatórios precisam de ícone aqui também —
  // mesmos paths (mesma origem sem Code Connect) já usados em
  // ../BottomNav/BottomNav.tsx para os mesmos itens.
  trophy:
    'M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0zM7 6H4a1 1 0 00-1 1 4 4 0 004 4M17 6h3a1 1 0 011 1 4 4 0 01-4 4',
  'bar-chart': 'M5 20V13M11 20V4M17 20V10M3 20h18',
  // Loja: mesmo path que o ICON_PATHS de ../BottomNav/BottomNav.tsx já usava
  // para este item — replicado aqui pelo mesmo motivo de trophy/bar-chart
  // (os dois dicionários são independentes, sem Code Connect para nenhum).
  bag: 'M6 7h12l1 14H5zM9 7a3 3 0 016 0',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  'user-circle':
    'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0M12 21a9 9 0 100-18 9 9 0 000 18z',
}

const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: 'home', label: 'Início' },
      { icon: 'calendar', label: 'Agenda' },
      { icon: 'users', label: 'Turmas' },
      { icon: 'user', label: 'Alunos' },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { icon: 'briefcase', label: 'Financeiro' },
      { icon: 'settings', label: 'Configurações' },
    ],
  },
]

const DEFAULT_FOOTER_ITEMS: SidebarNavItem[] = [{ icon: 'user-circle', label: 'Perfil' }]

function NavIcon({ icon }: { icon: string }) {
  const path = ICON_PATHS[icon] ?? ICON_PATHS.home
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}

function SidebarButton({
  item,
  active,
  onChange,
}: {
  item: SidebarNavItem
  active?: string
  onChange?: (label: string) => void
}) {
  const isActive = item.label === active
  return (
    <button
      type="button"
      className={`sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onChange?.(item.label)}
    >
      <NavIcon icon={item.icon} />
      <span className="sidebar__item-label">{item.label}</span>
    </button>
  )
}

export function Sidebar({
  logo,
  sections = DEFAULT_SECTIONS,
  footerItems = DEFAULT_FOOTER_ITEMS,
  arenaSelector,
  active,
  onChange,
}: SidebarProps) {
  return (
    <div className="sidebar">
      {logo ? <div className="sidebar__logo">{logo}</div> : null}
      <nav className="sidebar__nav" aria-label="Navegação principal">
        {sections.map((section) => (
          <div className="sidebar__section" key={section.label}>
            <p className="sidebar__section-label">{section.label}</p>
            {section.items.map((item) => (
              <SidebarButton key={item.label} item={item} active={active} onChange={onChange} />
            ))}
          </div>
        ))}
      </nav>
      {footerItems.length > 0 || arenaSelector ? (
        <div className="sidebar__footer">
          {footerItems.map((item) => (
            <SidebarButton key={item.label} item={item} active={active} onChange={onChange} />
          ))}
          {arenaSelector ? (
            <button type="button" className="sidebar__arena-selector" onClick={arenaSelector.onClick}>
              <span className="sidebar__arena-avatar" aria-hidden="true">
                {arenaSelector.avatar}
              </span>
              <span className="sidebar__arena-labels">
                <span className="sidebar__arena-name">{arenaSelector.label}</span>
                <span className="sidebar__arena-action">{arenaSelector.action}</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
