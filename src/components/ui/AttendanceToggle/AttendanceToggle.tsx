import type { ReactElement } from 'react'
import './AttendanceToggle.css'

export type AttendanceKind = 'present' | 'absent' | 'justified'

export interface AttendanceToggleProps {
  kind: AttendanceKind
  selected?: boolean
  label?: string
  onClick?: () => void
  disabled?: boolean
}

const DEFAULT_LABELS: Record<AttendanceKind, string> = {
  present: 'Presente',
  absent: 'Falta',
  justified: 'Justificada',
}

/** Inline placeholder glyphs (`currentColor`, matching the stroke/weight of
 * Icon/check.svg and Icon/close.svg) — the shared `Icon` component (node
 * pending, being built in parallel) doesn't exist yet and Justified has no
 * equivalent asset in `Icon/icons/` at all. Swap for real `Icon` instances
 * once available. */
function PresentGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AbsentGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function JustifiedGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0 0 18V3z" fill="currentColor" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const GLYPHS: Record<AttendanceKind, () => ReactElement> = {
  present: PresentGlyph,
  absent: AbsentGlyph,
  justified: JustifiedGlyph,
}

export function AttendanceToggle({ kind, selected = false, label, onClick, disabled = false }: AttendanceToggleProps) {
  const Glyph = GLYPHS[kind]
  return (
    <button
      type="button"
      className={`attendance-toggle attendance-toggle--${kind}${selected ? ' attendance-toggle--selected' : ''}`}
      aria-pressed={selected}
      aria-label={label ?? DEFAULT_LABELS[kind]}
      title={label ?? DEFAULT_LABELS[kind]}
      disabled={disabled}
      onClick={onClick}
    >
      <Glyph />
    </button>
  )
}

const KINDS: AttendanceKind[] = ['present', 'absent', 'justified']

export interface AttendanceGroupProps {
  value?: AttendanceKind | null
  onChange?: (kind: AttendanceKind) => void
  ariaLabel: string
  disabled?: boolean
}

/** Composes 3 `AttendanceToggle`s (Present/Absent/Justified) as a mutually
 * exclusive group — same "group manages the shared selection" shape as
 * `Segmented`, adapted for icon-only buttons instead of a sliding pill.
 * Clicking the already-selected kind clears it (re-clicking `value` calls
 * `onChange` with the same kind, letting the consumer decide whether that
 * means "clear" or "no-op" — a class check-in row must support "not marked
 * yet" as a real state, so this cannot force one kind to always be set). */
export function AttendanceGroup({ value = null, onChange, ariaLabel, disabled = false }: AttendanceGroupProps) {
  return (
    <div className="attendance-group" role="group" aria-label={ariaLabel}>
      {KINDS.map((kind) => (
        <AttendanceToggle
          key={kind}
          kind={kind}
          selected={value === kind}
          disabled={disabled}
          onClick={() => onChange?.(kind)}
        />
      ))}
    </div>
  )
}
