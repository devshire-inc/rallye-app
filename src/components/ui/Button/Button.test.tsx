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

  it('CSS: sizes map to control-height tokens, padding and font per spec', () => {
    const css = readFileSync('src/components/ui/Button/Button.css', 'utf8')
    expect(css).toMatch(/height:\s*var\(--control-h-sm\)/)
    expect(css).toMatch(/height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/height:\s*var\(--control-h-lg\)/)
    expect(css).toMatch(/padding:\s*0 14px/)
    expect(css).toMatch(/padding:\s*0 22px/)
    expect(css).toMatch(/padding:\s*0 28px/)
    expect(css).toMatch(/font:\s*800 13px/)
    expect(css).toMatch(/font:\s*800 15px/)
    expect(css).toMatch(/font:\s*800 16px/)
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
})
