import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pill } from './Pill'

describe('Pill', () => {
  it('renders its children', () => {
    render(<Pill>123456</Pill>)
    expect(screen.getByText('123456')).toBeInTheDocument()
  })

  it('renders rich children such as a bold label followed by a value', () => {
    render(
      <Pill>
        <b>DEMO</b> 123456
      </Pill>,
    )
    expect(screen.getByText('DEMO')).toBeInTheDocument()
    expect(screen.getByText('123456')).toBeInTheDocument()
  })

  it('applies a custom className alongside the base class', () => {
    render(<Pill className="custom">123456</Pill>)
    expect(screen.getByText('123456').closest('.pill')).toHaveClass('pill', 'custom')
  })

  it('CSS: base state uses --radius-lg and --surface-sunken per Figma (node 46:1085), no hex literals', () => {
    const css = readFileSync('src/components/ui/Pill/Pill.css', 'utf8')
    const baseBlock = /\.pill\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseBlock).toMatch(/border-radius:\s*var\(--radius-lg\)/)
    expect(baseBlock).toMatch(/background:\s*var\(--surface-sunken\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: bold/strong children use the Overline style and --text-muted', () => {
    const css = readFileSync('src/components/ui/Pill/Pill.css', 'utf8')
    const boldBlock = /\.pill b,\s*\n\.pill strong\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(boldBlock).toMatch(/font:\s*var\(--type-overline\)/)
    expect(boldBlock).toMatch(/letter-spacing:\s*var\(--tracking-overline\)/)
    expect(boldBlock).toMatch(/color:\s*var\(--text-muted\)/)
  })
})
