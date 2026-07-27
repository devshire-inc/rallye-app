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
  home: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  agenda: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  ranking:
    'M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0zM2 6h4v2a4 4 0 0 1-4-4zM22 6h-4v2a4 4 0 0 0 4-4z',
  members:
    'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2.5 2-5 5-5s5 2.5 5 5',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-7 8-7s8 3 8 7',
}

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

export function BottomNav({ items = [], active, onChange }: BottomNavProps) {
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
