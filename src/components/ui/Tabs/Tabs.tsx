import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { KeyboardEvent } from 'react'
import './Tabs.css'

export interface TabsProps {
  tabs?: string[]
  value?: string
  onChange?: (tab: string) => void
  ariaLabel?: string
}

export function Tabs({ tabs = [], value, onChange, ariaLabel = 'Abas de navegação' }: TabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>()
  const currentValue = value ?? tabs[0]

  // Slides the shared underline to the active tab instead of each button
  // drawing its own — same "measured indicator" pattern as Segmented, see
  // Segmented.tsx for the full rationale. Re-measured on every value/tabs
  // change (dynamic tab counts/labels mean widths aren't fixed), plus a
  // ResizeObserver for reflow outside our control.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const activeTab = container.querySelector<HTMLButtonElement>('.tabs__tab--active')
      if (!activeTab) {
        setIndicatorStyle(undefined)
        return
      }
      const style = {
        '--tabs-indicator-x': `${activeTab.offsetLeft}px`,
        '--tabs-indicator-width': `${activeTab.offsetWidth}px`,
      } as CSSProperties
      setIndicatorStyle(style)
    }

    measure()

    // jsdom (unit tests, Storybook a11y checks) doesn't implement
    // ResizeObserver — the [currentValue, tabs] deps above already cover this
    // component's real usages, so the observer is a browser-only extra.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [currentValue, tabs])

  function selectByIndex(index: number) {
    if (tabs.length === 0) return
    const wrapped = ((index % tabs.length) + tabs.length) % tabs.length
    const tab = tabs[wrapped]
    if (tab === undefined) return
    onChange?.(tab)
    buttonRefs.current[wrapped]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        selectByIndex(index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        selectByIndex(index - 1)
        break
      case 'Home':
        event.preventDefault()
        selectByIndex(0)
        break
      case 'End':
        event.preventDefault()
        selectByIndex(tabs.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel} ref={containerRef}>
      {indicatorStyle ? (
        <span className="tabs__indicator" style={indicatorStyle} aria-hidden="true" />
      ) : null}
      {tabs.map((tab, index) => {
        const isSelected = tab === currentValue
        return (
          <button
            key={tab}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`tabs__tab${isSelected ? ' tabs__tab--active' : ''}`}
            onClick={() => onChange?.(tab)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
