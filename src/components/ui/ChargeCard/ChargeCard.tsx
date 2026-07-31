import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import './ChargeCard.css'

export type ChargeStatus = 'confirmada' | 'pendente' | 'atrasada'

const STATUS_TONE = {
  confirmada: 'success',
  pendente: 'warning',
  atrasada: 'danger',
} as const

const STATUS_LABEL = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  atrasada: 'Atrasada',
} as const

export interface ChargeCardProps {
  payerName?: string
  description?: string
  amount?: string
  status?: ChargeStatus
  actionLabel?: string
  onAction?: () => void
}

export function ChargeCard({
  payerName,
  description,
  amount,
  status,
  actionLabel,
  onAction,
}: ChargeCardProps) {
  return (
    <div className="charge-card">
      {payerName ? <span className="charge-card__payer">{payerName}</span> : null}
      {description || amount ? (
        <div className="charge-card__row">
          {description ? <span className="charge-card__description">{description}</span> : null}
          {amount ? <span className="charge-card__amount">{amount}</span> : null}
        </div>
      ) : null}
      {status || (actionLabel && onAction) ? (
        <div className="charge-card__row">
          {status ? (
            <span className="charge-card__status">
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            </span>
          ) : null}
          {actionLabel && onAction ? (
            <Button variant="soft" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
