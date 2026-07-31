import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NavSummaryCard } from './NavSummaryCard'

describe('NavSummaryCard', () => {
  it('renders title and count label', () => {
    render(<NavSummaryCard title="Cobranças" countLabel="6 lançamentos" />)
    expect(screen.getByText('Cobranças')).toBeInTheDocument()
    expect(screen.getByText('6 lançamentos')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<NavSummaryCard title="Cobranças" />)
    expect(container.querySelector('div.nav-summary-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<NavSummaryCard title="Cobranças" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Cobranças/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders without throwing when no props are given', () => {
    expect(() => render(<NavSummaryCard />)).not.toThrow()
  })
})
