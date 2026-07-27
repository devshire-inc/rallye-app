import { useRef } from 'react'
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
  const currentValue = value ?? tabs[0]

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
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
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
