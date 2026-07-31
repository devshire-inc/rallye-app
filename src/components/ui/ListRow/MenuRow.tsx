import type { ReactNode } from 'react'
import { ChevronRightIcon } from './ListRow'
import './MenuRow.css'

export interface MenuRowProps {
  icon?: ReactNode
  label: string
  /** Valor à direita (ex.: "Ativado") — quando ausente, mostra o chevron de navegação. */
  value?: string
  onClick?: () => void
  testId?: string
}

export function MenuRow({ icon, label, value, onClick, testId }: MenuRowProps) {
  const content = (
    <>
      <span className="menu-row__leading">
        {icon ? (
          <span className="menu-row__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="menu-row__label">{label}</span>
      </span>
      {value ? (
        <span className="menu-row__value">{value}</span>
      ) : (
        <ChevronRightIcon className="menu-row__chevron" />
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="menu-row" onClick={onClick} data-testid={testId}>
        {content}
      </button>
    )
  }

  return (
    <div className="menu-row" data-testid={testId}>
      {content}
    </div>
  )
}
