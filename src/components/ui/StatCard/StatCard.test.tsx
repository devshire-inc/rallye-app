import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Reservas hoje" value="12" />)
    expect(screen.getByText('Reservas hoje')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders delta with the given tone', () => {
    render(<StatCard label="Faturamento" value="R$ 1.200" delta="+8%" deltaTone="success" />)
    expect(screen.getByText('+8%')).toBeInTheDocument()
  })

  it('never renders a <button> — it is standalone', () => {
    const { container } = render(<StatCard label="Reservas hoje" value="12" delta="+8%" />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })
})
