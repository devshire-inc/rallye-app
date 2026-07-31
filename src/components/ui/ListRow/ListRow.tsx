import type { CSSProperties, ReactNode } from 'react'
import { Avatar } from '../Avatar/Avatar'
import { Badge, type BadgeProps } from '../Badge/Badge'
import './ListRow.css'

export type ListRowLeading =
  | { type: 'avatar'; name?: string; src?: string }
  | { type: 'strip'; color: string }

export type ListRowTrailing =
  | { type: 'badge'; tone?: BadgeProps['tone']; children: ReactNode }
  | { type: 'chevron' }
  /** Escape hatch para trailing composto (ex.: uma ação + um Badge
   * empilhados) que não cabe em `badge`/`chevron` — ver AG3StudentAgendaPage
   * (BEAC-1926), única consumidora até agora. */
  | { type: 'custom'; children: ReactNode }
  | { type: 'none' }

export interface ListRowProps {
  leading: ListRowLeading
  /** Normalmente uma string; aceita `ReactNode` para casos como AG3 (BEAC-1926)
   * que precisam de um trecho do título isolado em seu próprio elemento
   * (ex.: para asserts de teste em `getByText` num nome de aula específico
   * dentro de uma linha "horário · nome"). */
  title: ReactNode
  meta?: string
  trailing?: ListRowTrailing
  onClick?: () => void
}

const DEFAULT_TRAILING: ListRowTrailing = { type: 'none' }

/** Fallback inline até o `Icon` compartilhado existir (ver `icon/chevron-right`,
 * Figma node 115:29) — trocar por `<Icon name="chevron-right" />` quando disponível. */
export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ListRow({ leading, title, meta, trailing = DEFAULT_TRAILING, onClick }: ListRowProps) {
  const stripStyle =
    leading.type === 'strip'
      ? ({ '--list-row-strip-color': leading.color } as CSSProperties)
      : undefined

  const content = (
    <>
      {leading.type === 'avatar' ? (
        <Avatar name={leading.name} src={leading.src} size="md" />
      ) : (
        <span className="list-row__strip" style={stripStyle} aria-hidden="true" />
      )}
      <span className="list-row__content">
        <span className="list-row__title">{title}</span>
        {meta ? <span className="list-row__meta">{meta}</span> : null}
      </span>
      {trailing.type === 'badge' ? (
        <span className="list-row__trailing">
          <Badge tone={trailing.tone}>{trailing.children}</Badge>
        </span>
      ) : null}
      {trailing.type === 'chevron' ? <ChevronRightIcon className="list-row__chevron" /> : null}
      {trailing.type === 'custom' ? <span className="list-row__trailing">{trailing.children}</span> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="list-row" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="list-row">{content}</div>
}
