import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('is locatable via getByLabelText when label is given, and htmlFor/id match', () => {
    render(<Input label="E-mail" />)
    const input = screen.getByLabelText('E-mail')
    const label = screen.getByText('E-mail')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', input.id)
  })

  it('is locatable via getByLabelText when only ariaLabel is given (no visible label)', () => {
    render(<Input ariaLabel="Buscar quadra" />)
    const input = screen.getByLabelText('Buscar quadra')
    expect(screen.queryByRole('label')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-label', 'Buscar quadra')
  })

  it('honors an explicit id instead of generating one', () => {
    render(<Input label="Nome" id="custom-id" />)
    expect(screen.getByLabelText('Nome')).toHaveAttribute('id', 'custom-id')
  })

  it('renders helper text and error text when given', () => {
    render(<Input label="Senha" helper="Mínimo 8 caracteres" error="Senha inválida" />)
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Senha inválida')).toBeInTheDocument()
  })

  it('marks the control as aria-invalid when an error is given, not otherwise', () => {
    const { rerender } = render(<Input label="Senha" />)
    expect(screen.getByLabelText('Senha')).not.toHaveAttribute('aria-invalid')
    rerender(<Input label="Senha" error="Senha inválida" />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders a prefix when given', () => {
    render(<Input label="Preço" prefix="R$" />)
    expect(screen.getByText('R$')).toBeInTheDocument()
  })

  it('renders a suffix slot inside the field, e.g. for PasswordInput\'s toggle', () => {
    render(<Input label="Senha" suffix={<button type="button">toggle</button>} />)
    expect(screen.getByRole('button', { name: 'toggle' })).toBeInTheDocument()
  })

  it('applies wrapperClassName to the outer wrapper without touching input__control', () => {
    const { container } = render(<Input label="Senha" wrapperClassName="password-input" />)
    expect(container.querySelector('.input')).toHaveClass('password-input')
    expect(screen.getByLabelText('Senha')).toHaveClass('input__control')
  })

  it('forwards native input attributes and disabled without breaking id/htmlFor', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input label="Apelido" placeholder="ex: Bruno" maxLength={5} onChange={onChange} />)
    const input = screen.getByLabelText('Apelido')
    expect(input).toHaveAttribute('placeholder', 'ex: Bruno')
    expect(input).toHaveAttribute('maxlength', '5')
    await user.type(input, 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards disabled', () => {
    render(<Input label="Campo" disabled />)
    expect(screen.getByLabelText('Campo')).toBeDisabled()
  })

  it('adds the disabled wrapper class so the whole block dims (label + field + helper)', () => {
    const { container } = render(<Input label="Campo" disabled />)
    expect(container.querySelector('.input')).toHaveClass('input--disabled')
  })

  it('defaults size to md when omitted', () => {
    const { container } = render(<Input label="Campo" />)
    expect(container.querySelector('.input__field')).toHaveClass('input__field--md')
  })

  it.each(['sm', 'md', 'lg'] as const)('applies the input__field--%s class for size="%s"', (size) => {
    const { container } = render(<Input label="Campo" size={size} />)
    expect(container.querySelector('.input__field')).toHaveClass(`input__field--${size}`)
  })

  it('adds the input__field--error class when an error is given', () => {
    const { container } = render(<Input label="Campo" error="Obrigatório" />)
    expect(container.querySelector('.input__field')).toHaveClass('input__field--error')
  })

  it('CSS: sizes per spec (Figma node 31:26) — heights, radii, border widths, no hex literals', () => {
    const css = readFileSync('src/components/ui/Input/Input.css', 'utf8')
    // Small
    expect(css).toMatch(/\.input__field--sm\s*\{[^}]*height:\s*38px/)
    expect(css).toMatch(/\.input__field--sm\s*\{[^}]*border-radius:\s*12px/)
    // Medium — matches design system tokens exactly
    expect(css).toMatch(/\.input__field--md\s*\{[^}]*height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/\.input__field--md\s*\{[^}]*border-radius:\s*var\(--radius-md\)/)
    // Large
    expect(css).toMatch(/\.input__field--lg\s*\{[^}]*height:\s*var\(--control-h-lg\)/)
    expect(css).toMatch(/\.input__field--lg\s*\{[^}]*border-radius:\s*16px/)
    // Shared field styles
    expect(css).toMatch(/border-color:\s*var\(--border-default\)/)
    expect(css).toMatch(/font:\s*var\(--type-body\)/)
    expect(css).toMatch(/color:\s*var\(--text-body\)/)
    // Error state — 2px danger border, danger-text helper color
    expect(css).toMatch(/\.input__field--error\s*\{[^}]*border-width:\s*2px/)
    expect(css).toMatch(/\.input__field--error\s*\{[^}]*border-color:\s*var\(--state-danger\)/)
    expect(css).toMatch(/\.input__error\s*\{[^}]*color:\s*var\(--state-danger-text\)/)
    // Focus ring standard (doc node 258:747)
    expect(css).toMatch(/:focus-within\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
    // Disabled — whole block dims per Figma (opacity-60)
    expect(css).toMatch(/\.input--disabled\s*\{[^}]*opacity:\s*0\.6/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
