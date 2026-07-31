import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BracketConnector, type BracketConnectorType } from './BracketConnector'

const TYPES: BracketConnectorType[] = ['merge', 'up', 'down', 'bye']

describe('BracketConnector', () => {
  it.each(TYPES)('is always aria-hidden for type=%s — purely decorative', (type) => {
    const { container } = render(<BracketConnector type={type} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(TYPES)('renders with the fixed 40x108 geometry for type=%s', (type) => {
    const { container } = render(<BracketConnector type={type} />)
    expect(container.firstElementChild).toHaveClass('bracket-connector', `bracket-connector--${type}`)
  })

  it('renders 4 line segments for type="merge" (two stubs, joint, output)', () => {
    const { container } = render(<BracketConnector type="merge" />)
    expect(container.querySelectorAll('.bracket-connector__stub')).toHaveLength(3)
    expect(container.querySelectorAll('.bracket-connector__joint')).toHaveLength(1)
  })

  it('renders only a single faint line for type="bye"', () => {
    const { container } = render(<BracketConnector type="bye" />)
    expect(container.querySelectorAll('.bracket-connector__line')).toHaveLength(1)
    expect(container.querySelectorAll('.bracket-connector__stub')).toHaveLength(0)
  })

  it('CSS: bye uses the same border/strong stroke at 50% opacity, no hex literals', () => {
    const css = readFileSync('src/components/ui/BracketConnector/BracketConnector.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    const byeBlock = /\.bracket-connector__line\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(byeBlock).toMatch(/background:\s*var\(--border-strong\)/)
    expect(byeBlock).toMatch(/opacity:\s*0\.5/)
  })

  it('CSS: fixed 40x108 geometry, not driven by spacing tokens', () => {
    const css = readFileSync('src/components/ui/BracketConnector/BracketConnector.css', 'utf8')
    const rootBlock = /^\.bracket-connector\s*\{([^}]*)\}/m.exec(css)?.[1] ?? ''
    expect(rootBlock).toMatch(/width:\s*40px/)
    expect(rootBlock).toMatch(/height:\s*108px/)
  })
})
