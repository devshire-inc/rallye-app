import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from '../ui/IconButton/IconButton'
import './BottomSheet.css'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Accessible name for the dialog region (e.g. "Entrar em nova arena"); also shown as the sheet's header title. */
  label?: string
}

/**
 * Generic bottom sheet primitive (BEAC-1808, Figma node 95:6): drag handle +
 * header (title/close) + content, sliding up from the bottom over a scrim,
 * dismissible via the close button, backdrop click, or Escape. Not specific
 * to invites — any future feature can reuse this same primitive.
 *
 * No portal: this app's single #root (see index.html) has no z-index
 * conflicts today, so `position: fixed` on the backdrop already escapes any
 * ancestor's layout/stacking context. Skipping ReactDOM.createPortal (and
 * the dedicated portal root div it would require in index.html) keeps this
 * first bottom-sheet implementation as simple as possible; revisit if a
 * later screen introduces real stacking-context conflicts.
 */
export function BottomSheet({ open, onClose, children, label }: BottomSheetProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={label ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <div className="bottom-sheet-header">
          {label ? (
            <h2 className="bottom-sheet-title" id={titleId}>
              {label}
            </h2>
          ) : null}
          <IconButton variant="ghost" size="md" label="Fechar" onClick={onClose}>
            ×
          </IconButton>
        </div>
        <div className="bottom-sheet-content">{children}</div>
      </div>
    </div>
  )
}
