import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('renders a native button, type=button by default, label as aria-label and title', () => {
    render(<IconButton label="Fechar">×</IconButton>)
    const button = screen.getByRole('button', { name: 'Fechar' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('title', 'Fechar')
  })

  it('supports type=submit', () => {
    render(
      <IconButton label="Enviar" type="submit">
        →
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <IconButton label="Curtir" onClick={onClick}>
        ♥
      </IconButton>,
    )
    await user.click(screen.getByRole('button', { name: 'Curtir' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <IconButton label="Curtir" onClick={onClick} disabled>
        ♥
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Curtir' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('CSS: circular dimensions per size, exact token mapping per variant, no hex literals', () => {
    const css = readFileSync('src/components/ui/IconButton/IconButton.css', 'utf8')
    expect(css).toMatch(/34px/)
    expect(css).toMatch(/46px/)
    expect(css).toMatch(/54px/)
    expect(css).toMatch(/border-radius:\s*50%|var\(--radius-pill\)/)
    expect(css).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).toMatch(/background:\s*var\(--surface-card\)/)
    expect(css).toMatch(/color:\s*var\(--text-heading\)/)
    expect(css).toMatch(/border:\s*1px solid var\(--border-default\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
