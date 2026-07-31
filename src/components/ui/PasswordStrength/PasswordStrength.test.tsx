import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PasswordStrength } from './PasswordStrength'

describe('PasswordStrength', () => {
  it.each([
    ['none', '—'],
    ['weak', 'Fraca'],
    ['medium', 'Média'],
    ['strong', 'Forte'],
  ] as const)('renders the level word as text for level=%s', (level, word) => {
    render(<PasswordStrength level={level} />)
    expect(screen.getByText(word)).toBeInTheDocument()
  })

  it('renders the default requirement checklist met per level (medium: 8 chars + 1 number, not uppercase)', () => {
    render(<PasswordStrength level="medium" />)
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('1 número')).toBeInTheDocument()
    expect(screen.getByText('1 letra maiúscula')).toBeInTheDocument()
  })

  it('accepts a custom requirement list', () => {
    render(
      <PasswordStrength
        level="weak"
        requirements={[{ label: 'Sem espaços', met: true }]}
      />,
    )
    expect(screen.getByText('Sem espaços')).toBeInTheDocument()
    expect(screen.queryByText('Mínimo 8 caracteres')).not.toBeInTheDocument()
  })

  it('accepts a custom caption', () => {
    render(<PasswordStrength level="none" caption="Segurança" />)
    expect(screen.getByText('Segurança')).toBeInTheDocument()
  })

  it('renders 4 bar segments regardless of level', () => {
    const { container } = render(<PasswordStrength level="strong" />)
    expect(container.querySelectorAll('.password-strength__bar')).toHaveLength(4)
  })

  it('fills bars matching the level (weak=1, medium=2, strong=4)', () => {
    const { container: weak } = render(<PasswordStrength level="weak" />)
    expect(weak.querySelectorAll('.password-strength__bar--weak')).toHaveLength(1)

    const { container: medium } = render(<PasswordStrength level="medium" />)
    expect(medium.querySelectorAll('.password-strength__bar--medium')).toHaveLength(2)

    const { container: strong } = render(<PasswordStrength level="strong" />)
    expect(strong.querySelectorAll('.password-strength__bar--strong')).toHaveLength(4)
  })

  it('CSS: 4 segments, tone mapping per level, no hex literals', () => {
    const css = readFileSync('src/components/ui/PasswordStrength/PasswordStrength.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--state-danger\)/)
    expect(css).toMatch(/background:\s*var\(--state-warning\)/)
    expect(css).toMatch(/background:\s*var\(--state-success\)/)
    expect(css).toMatch(/color:\s*var\(--state-danger-text\)/)
    expect(css).toMatch(/color:\s*var\(--state-warning-text\)/)
    expect(css).toMatch(/color:\s*var\(--state-success-text\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
