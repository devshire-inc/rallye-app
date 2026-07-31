import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from '../IconButton/IconButton'
import './Modal.css'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  /** Se o clique no scrim fecha o modal. Desative quando o corpo contém dado
   * preenchido a perder (ex.: formulário) — ver "Acessibilidade" no doc Figma. */
  closeOnScrimClick?: boolean
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo modal desktop (Figma node 194:4): scrim + card centralizado,
 * header (título/fechar), corpo e footer com Buttons reais. Foco entra no
 * card ao abrir e fica preso dentro dele (Tab/Shift+Tab não escapam para a
 * página atrás); ao fechar, volta para o elemento que abriu o modal.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  closeOnScrimClick = true,
}: ModalProps) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    cardRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const card = cardRef.current
      const nodes = card ? Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }

      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first || !card?.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last || !card?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-scrim" onClick={closeOnScrimClick ? onClose : undefined}>
      <div
        ref={cardRef}
        className={`modal-card modal-card--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <IconButton variant="ghost" size="sm" label="Fechar" onClick={onClose}>
            ×
          </IconButton>
        </div>
        <div className="modal-divider" />
        <div className="modal-body">{children}</div>
        {footer ? (
          <>
            <div className="modal-divider" />
            <div className="modal-footer">{footer}</div>
          </>
        ) : null}
      </div>
    </div>
  )
}
