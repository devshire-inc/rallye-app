import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MenuRow } from './MenuRow'

describe('MenuRow', () => {
  it('renders the label', () => {
    render(<MenuRow label="Editar perfil" />)
    expect(screen.getByText('Editar perfil')).toBeInTheDocument()
  })

  it('renders the given icon', () => {
    render(<MenuRow label="Editar perfil" icon={<span data-testid="my-icon" />} />)
    expect(screen.getByTestId('my-icon')).toBeInTheDocument()
  })

  it('renders no leading icon wrapper when icon is omitted', () => {
    const { container } = render(<MenuRow label="Editar perfil" />)
    expect(container.querySelector('.menu-row__icon')).not.toBeInTheDocument()
  })

  it('renders a trailing chevron by default (no value given)', () => {
    const { container } = render(<MenuRow label="Editar perfil" />)
    expect(container.querySelector('.menu-row__chevron')).toBeInTheDocument()
    expect(container.querySelector('.menu-row__value')).not.toBeInTheDocument()
  })

  it('renders the trailing value text instead of the chevron when given', () => {
    render(<MenuRow label="Notificações" value="Ativado" />)
    expect(screen.getByText('Ativado')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<MenuRow label="Editar perfil" />)
    expect(container.querySelector('div.menu-row')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<MenuRow label="Editar perfil" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Editar perfil/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
