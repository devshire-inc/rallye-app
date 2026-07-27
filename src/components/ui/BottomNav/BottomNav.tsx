import './BottomNav.css'

export interface BottomNavItem {
  icon: string
  label: string
}

export interface BottomNavProps {
  items?: BottomNavItem[]
  active?: string
  onChange?: (label: string) => void
}

const ICON_PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  trophy:
    'M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0zM7 6H4a1 1 0 00-1 1 4 4 0 004 4M17 6h3a1 1 0 011 1 4 4 0 01-4 4',
  bag: 'M6 7h12l1 14H5zM9 7a3 3 0 016 0',
  user: 'M20 21a8 8 0 00-16 0M12 13a4 4 0 100-8 4 4 0 000 8z',
}

const DEFAULT_ITEMS: BottomNavItem[] = [
  { icon: 'home', label: 'Início' },
  { icon: 'calendar', label: 'Agenda' },
  { icon: 'trophy', label: 'Torneios' },
  { icon: 'bag', label: 'Loja' },
  { icon: 'user', label: 'Perfil' },
]

function NavIcon({ icon }: { icon: string }) {
  const path = ICON_PATHS[icon] ?? ICON_PATHS.home
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
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

export function BottomNav({ items = DEFAULT_ITEMS, active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const isActive = item.label === active
        return (
          <button
            key={item.label}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange?.(item.label)}
          >
            <NavIcon icon={item.icon} />
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
