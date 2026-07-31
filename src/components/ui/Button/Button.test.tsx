import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders a native button with type=button by default', () => {
    render(<Button>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('supports type=submit', () => {
    render(<Button type="submit">Enviar</Button>)
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Clique</Button>)
    await user.click(screen.getByRole('button', { name: 'Clique' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button onClick={onClick} disabled>
        Indisponível
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Indisponível' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders the icon alongside children', () => {
    render(<Button icon={<span data-testid="icon">i</span>}>Texto</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('Texto')
  })

  it('is disabled, marked aria-busy and does not fire onClick when loading', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button onClick={onClick} loading>
        Salvando
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Salvando' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a spinner instead of the icon when loading', () => {
    render(
      <Button icon={<span data-testid="icon">i</span>} loading>
        Salvando
      </Button>,
    )
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Salvando' })
    expect(button.querySelector('.button__spinner')).toBeInTheDocument()
  })

  it('is not marked aria-busy and has no aria-busy attribute by default', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-busy')
  })

  it('CSS: sizes map to the right dimensions, padding and type scale per spec', () => {
    const css = readFileSync('src/components/ui/Button/Button.css', 'utf8')
    // Small (34px) is desktop-only per Figma doc — not the shared --control-h-sm
    // touch-target token, which is reserved for touch-surface controls (inputs).
    expect(css).toMatch(/\.button--sm\s*\{[^}]*height:\s*34px/)
    expect(css).toMatch(/\.button--md\s*\{[^}]*height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/\.button--lg\s*\{[^}]*height:\s*var\(--control-h-lg\)/)
    expect(css).toMatch(/\.button--sm\s*\{[^}]*padding:\s*0 14px/)
    expect(css).toMatch(/\.button--md\s*\{[^}]*padding:\s*0 22px/)
    expect(css).toMatch(/\.button--lg\s*\{[^}]*padding:\s*0 28px/)
    expect(css).toMatch(/\.button--sm\s*\{[^}]*font:\s*var\(--type-label\)/)
    expect(css).toMatch(/\.button--md\s*\{[^}]*font:\s*var\(--type-subtitle\)/)
    expect(css).toMatch(/\.button--lg\s*\{[^}]*font:\s*var\(--type-subtitle\)/)
  })

  it('CSS: variants use the exact token mapping, no hex literals', () => {
    const css = readFileSync('src/components/ui/Button/Button.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).toMatch(/color:\s*var\(--text-heading\)/)
    expect(css).toMatch(/border:\s*2px solid var\(--border-strong\)/)
    expect(css).toMatch(/color:\s*var\(--text-brand\)/)
    expect(css).toMatch(/background:\s*var\(--state-danger\)/)
    expect(css).toMatch(/background:\s*var\(--surface-brand-soft\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/opacity:\s*0?\.45/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: focus-visible uses the shared focus-ring token', () => {
    const css = readFileSync('src/components/ui/Button/Button.css', 'utf8')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
  })

  it('CSS: loading state keeps full opacity and dims only the label', () => {
    const css = readFileSync('src/components/ui/Button/Button.css', 'utf8')
    expect(css).toMatch(/\.button--loading:disabled\s*\{[^}]*opacity:\s*1/)
    expect(css).toMatch(/\.button--loading \.button__label\s*\{[^}]*opacity:\s*0?\.55/)
  })
})
