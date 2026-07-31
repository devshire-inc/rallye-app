import chevronRightIcon from './icons/chevron-right.svg'
import './NavSummaryCard.css'

export interface NavSummaryCardProps {
  title?: string
  countLabel?: string
  onClick?: () => void
}

export function NavSummaryCard({ title, countLabel, onClick }: NavSummaryCardProps) {
  const content = (
    <>
      <span className="nav-summary-card__info">
        {title ? <span className="nav-summary-card__title">{title}</span> : null}
        {countLabel ? <span className="nav-summary-card__count">{countLabel}</span> : null}
      </span>
      <img src={chevronRightIcon} alt="" className="nav-summary-card__chevron" />
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="nav-summary-card" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="nav-summary-card">{content}</div>
}
