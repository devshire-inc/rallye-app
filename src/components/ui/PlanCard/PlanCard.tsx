import { Badge, type BadgeProps } from '../Badge/Badge'
import './PlanCard.css'

export interface PlanCardProps {
  planLabel?: string
  badgeLabel?: string
  badgeTone?: BadgeProps['tone']
  price?: string
  pricePeriod?: string
  description?: string
  onClick?: () => void
}

export function PlanCard({
  planLabel,
  badgeLabel,
  badgeTone = 'success',
  price,
  pricePeriod,
  description,
  onClick,
}: PlanCardProps) {
  const content = (
    <>
      {planLabel || badgeLabel ? (
        <div className="plan-card__row">
          {planLabel ? <span className="plan-card__label">{planLabel}</span> : null}
          {badgeLabel ? <Badge tone={badgeTone}>{badgeLabel}</Badge> : null}
        </div>
      ) : null}
      {price ? (
        <div className="plan-card__price-row">
          <span className="plan-card__price">{price}</span>
          {pricePeriod ? <span className="plan-card__price-period">{pricePeriod}</span> : null}
        </div>
      ) : null}
      {description ? <p className="plan-card__description">{description}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="plan-card" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="plan-card">{content}</div>
}
