import './Segmented.css'

export interface SegmentedProps {
  options?: string[]
  value?: string
  onChange?: (value: string) => void
  ariaLabel: string
}

export function Segmented({ options = [], value, onChange, ariaLabel }: SegmentedProps) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option === value
        return (
          <button
            key={option}
            type="button"
            className={`segmented__option${isActive ? ' segmented__option--active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange?.(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
