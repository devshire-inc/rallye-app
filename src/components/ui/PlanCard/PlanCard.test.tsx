import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlanCard } from './PlanCard'

describe('PlanCard', () => {
  it('imports the real Badge component — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/PlanCard/PlanCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it('renders plan label, price, period and description', () => {
    render(
      <PlanCard
        planLabel="Mensal · 2x/semana"
        price="R$ 240"
        pricePeriod="/mês"
        description="2 aulas por semana + acesso à quadra livre nos fins de semana."
      />,
    )
    expect(screen.getByText('Mensal · 2x/semana')).toBeInTheDocument()
    expect(screen.getByText('R$ 240')).toBeInTheDocument()
    expect(screen.getByText('/mês')).toBeInTheDocument()
    expect(
      screen.getByText('2 aulas por semana + acesso à quadra livre nos fins de semana.'),
    ).toBeInTheDocument()
  })

  it('only renders the Badge when badgeLabel is given', () => {
    const { rerender } = render(<PlanCard planLabel="Mensal" />)
    expect(screen.queryByText('Confirmada')).not.toBeInTheDocument()

    rerender(<PlanCard planLabel="Mensal" badgeLabel="Confirmada" badgeTone="success" />)
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<PlanCard planLabel="Mensal" />)
    expect(container.querySelector('div.plan-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<PlanCard planLabel="Mensal" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Mensal/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
