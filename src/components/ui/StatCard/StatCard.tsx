import './StatCard.css'

export interface StatCardProps {
  label?: string
  value?: string
  delta?: string
  deltaTone?: 'success' | 'danger'
}

export function StatCard({ label, value, delta, deltaTone }: StatCardProps) {
  return (
    <div className="stat-card">
      {label ? <span className="stat-card__label">{label}</span> : null}
      {value ? <span className="stat-card__value">{value}</span> : null}
      {delta ? (
        <span className={`stat-card__delta${deltaTone ? ` stat-card__delta--${deltaTone}` : ''}`}>
          {delta}
        </span>
      ) : null}
    </div>
  )
}
