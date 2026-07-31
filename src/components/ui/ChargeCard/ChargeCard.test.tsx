import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChargeCard } from './ChargeCard'

describe('ChargeCard', () => {
  it('imports the real Badge/Button components — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/ChargeCard/ChargeCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
    expect(source).toMatch(/from ['"]\.\.\/Button\/Button['"]/)
  })

  it('renders payer, description and amount', () => {
    render(
      <ChargeCard
        payerName="Marina Costa"
        description="Mensalidade agosto · vence 05/08"
        amount="R$ 240"
      />,
    )
    expect(screen.getByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('Mensalidade agosto · vence 05/08')).toBeInTheDocument()
    expect(screen.getByText('R$ 240')).toBeInTheDocument()
  })

  it.each([
    ['confirmada', 'Confirmada'],
    ['pendente', 'Pendente'],
    ['atrasada', 'Atrasada'],
  ] as const)('maps status=%s to the correct Badge tone/label', (status, label) => {
    render(<ChargeCard payerName="Marina Costa" status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('only renders the action button when both actionLabel and onAction are given', () => {
    const { rerender } = render(<ChargeCard payerName="Marina Costa" actionLabel="Marcar como pago" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    const onAction = vi.fn()
    rerender(
      <ChargeCard payerName="Marina Costa" actionLabel="Marcar como pago" onAction={onAction} />,
    )
    expect(screen.getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument()
  })

  it('calls onAction when the action button is clicked', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <ChargeCard payerName="Marina Costa" actionLabel="Marcar como pago" onAction={onAction} />,
    )
    await user.click(screen.getByRole('button', { name: 'Marcar como pago' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
