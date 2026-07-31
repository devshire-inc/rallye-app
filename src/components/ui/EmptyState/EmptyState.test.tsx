import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Icon } from '../Icon/Icon'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="Nenhuma reserva encontrada" description="Quando você fizer uma reserva, ela vai aparecer aqui." />)
    expect(screen.getByText('Nenhuma reserva encontrada')).toBeInTheDocument()
    expect(screen.getByText('Quando você fizer uma reserva, ela vai aparecer aqui.')).toBeInTheDocument()
  })

  it('omits the description when none is given', () => {
    render(<EmptyState title="Nenhuma reserva encontrada" />)
    expect(screen.queryByText('Quando você fizer uma reserva, ela vai aparecer aqui.')).not.toBeInTheDocument()
  })

  it('marks the illustration as decorative with aria-hidden', () => {
    const { container } = render(
      <EmptyState title="Nenhuma reserva encontrada" icon={<Icon name="calendar" size={40} />} />,
    )
    const illustration = container.querySelector('.empty-state__illustration')
    expect(illustration).not.toBeNull()
    expect(illustration).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not render a CTA when actionLabel and onAction are omitted', () => {
    render(<EmptyState title="Nenhuma reserva encontrada" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not render a CTA when only actionLabel is given', () => {
    render(<EmptyState title="Nenhuma reserva encontrada" actionLabel="Fazer reserva" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not render a CTA when only onAction is given', () => {
    render(<EmptyState title="Nenhuma reserva encontrada" onAction={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the CTA and fires onAction when clicked', () => {
    const onAction = vi.fn()
    render(<EmptyState title="Nenhuma reserva encontrada" actionLabel="Fazer reserva" onAction={onAction} />)
    const button = screen.getByRole('button', { name: 'Fazer reserva' })
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
