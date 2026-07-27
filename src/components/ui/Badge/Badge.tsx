import type { ReactNode } from 'react'
import './Badge.css'

export interface BadgeProps {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'
  children?: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
