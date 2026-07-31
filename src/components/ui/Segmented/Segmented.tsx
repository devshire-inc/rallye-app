import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import './Segmented.css'

export interface SegmentedProps {
  options?: string[]
  value?: string
  onChange?: (value: string) => void
  ariaLabel: string
}

export function Segmented({ options = [], value, onChange, ariaLabel }: SegmentedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>()

  // Slides the shared indicator to the active button instead of each button
  // toggling its own background instantly — measured on every value/options
  // change (dynamic option counts/labels mean segment widths aren't fixed),
  // plus a ResizeObserver for cases outside our control (container reflow,
  // font loading, viewport resize) that don't touch either dependency.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const activeButton = container.querySelector<HTMLButtonElement>('.segmented__option--active')
      if (!activeButton) {
        setIndicatorStyle(undefined)
        return
      }
      const style = {
        '--segmented-indicator-x': `${activeButton.offsetLeft}px`,
        '--segmented-indicator-width': `${activeButton.offsetWidth}px`,
      } as CSSProperties
      setIndicatorStyle(style)
    }

    measure()

    // jsdom (unit tests, Storybook a11y checks) doesn't implement
    // ResizeObserver — the [value, options] deps above already cover this
    // component's real usages, so the observer is a browser-only extra.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [value, options])

  return (
    <div className="segmented" role="group" aria-label={ariaLabel} ref={containerRef}>
      {indicatorStyle ? (
        <span className="segmented__indicator" style={indicatorStyle} aria-hidden="true" />
      ) : null}
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
