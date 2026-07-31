import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput', () => {
  it('renders type=password by default (masked)', () => {
    render(<PasswordInput label="Senha" />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('shows a real <button type="button"> toggle, aria-label "Mostrar senha" when hidden', () => {
    render(<PasswordInput label="Senha" />)
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveAttribute('type', 'button')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles to type=text, aria-label "Ocultar senha", aria-pressed=true on click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput label="Senha" />)
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    const toggle = screen.getByRole('button', { name: 'Ocultar senha' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles back to password on a second click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput label="Senha" />)
    const toggle = () => screen.getByRole('button', { name: /mostrar senha|ocultar senha/i })
    await user.click(toggle())
    await user.click(toggle())
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('keeps focus on the field itself after toggling visibility', async () => {
    const user = userEvent.setup()
    render(<PasswordInput label="Senha" />)
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveFocus()
  })

  it('reuses Input for label/helper/error rendering', () => {
    render(<PasswordInput label="Senha" helper="Mínimo 8 caracteres" error="Senha inválida" />)
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Senha inválida')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
  })

  it('is locatable via ariaLabel when no visible label is given', () => {
    render(<PasswordInput ariaLabel="Senha de acesso" />)
    expect(screen.getByLabelText('Senha de acesso')).toBeInTheDocument()
  })

  it('disables both the field and the toggle when disabled', () => {
    render(<PasswordInput label="Senha" disabled />)
    expect(screen.getByLabelText('Senha')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeDisabled()
  })

  it('forwards size to the underlying Input field', () => {
    const { container } = render(<PasswordInput label="Senha" size="lg" />)
    expect(container.querySelector('.input__field')).toHaveClass('input__field--lg')
  })

  it('CSS: Small is the documented 34px exception, toggle right padding matches Figma gutter, no hex literals', () => {
    const css = readFileSync('src/components/ui/PasswordInput/PasswordInput.css', 'utf8')
    expect(css).toMatch(/\.password-input \.input__field--sm\s*\{[^}]*height:\s*34px/)
    expect(css).toMatch(/padding-right:\s*var\(--space-2\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
