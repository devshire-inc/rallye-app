import './SlotChip.css'

export interface SlotChipProps {
  time?: string
  state?: 'available' | 'selected' | 'busy'
  onClick?: () => void
}

export function SlotChip({ time, state = 'available', onClick }: SlotChipProps) {
  return (
    <button
      type="button"
      className={`slot-chip slot-chip--${state}`}
      disabled={state === 'busy'}
      aria-pressed={state === 'selected'}
      onClick={onClick}
    >
      {time}
    </button>
  )
}
