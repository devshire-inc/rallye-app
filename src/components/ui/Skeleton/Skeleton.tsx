import type { ReactNode } from 'react'
import './Skeleton.css'

export type SkeletonType = 'text' | 'avatar' | 'card' | 'tableRow'

export interface SkeletonProps {
  type: SkeletonType
  /** Só usado em type="text" — número de linhas (Figma mostra 3). */
  lines?: number
  className?: string
}

/**
 * Placeholder de carregamento (Figma node 201:39). Decorativo — marcado
 * aria-hidden; para anunciar o carregamento ao leitor de tela, envolva as
 * instâncias em <SkeletonGroup label="...">.
 */
export function Skeleton({ type, lines = 3, className }: SkeletonProps) {
  const rootClassName = ['skeleton', `skeleton--${type}`, className].filter(Boolean).join(' ')

  if (type === 'text') {
    return (
      <div className={rootClassName} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="skeleton__shape skeleton__line" />
        ))}
      </div>
    )
  }

  if (type === 'avatar') {
    return <span className={`${rootClassName} skeleton__shape`} aria-hidden="true" />
  }

  if (type === 'card') {
    return (
      <div className={rootClassName} aria-hidden="true">
        <span className="skeleton__shape skeleton__image" />
        <span className="skeleton__shape skeleton__line" />
        <span className="skeleton__shape skeleton__line" />
      </div>
    )
  }

  return (
    <div className={rootClassName} aria-hidden="true">
      <span className="skeleton__shape skeleton__avatar" />
      <span className="skeleton__shape skeleton__line skeleton__line--flex" />
      <span className="skeleton__shape skeleton__line skeleton__line--md" />
      <span className="skeleton__shape skeleton__line skeleton__line--sm" />
    </div>
  )
}

export interface SkeletonGroupProps {
  /** Texto anunciado uma única vez na região aria-live, ex. "Carregando reservas". */
  label: string
  children: ReactNode
}

/**
 * Agrupa várias instâncias de <Skeleton> sob uma única região aria-live,
 * para que uma lista de N skeletons anuncie o carregamento uma vez só
 * (Figma node 240:91, "ACESSIBILIDADE") em vez de uma vez por bloco.
 */
export function SkeletonGroup({ label, children }: SkeletonGroupProps) {
  return (
    <div className="skeleton-group">
      <span className="skeleton-group__announcement" role="status" aria-live="polite">
        {label}
      </span>
      {children}
    </div>
  )
}
