import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlertCard } from './AlertCard'

describe('AlertCard', () => {
  it('renders its children', () => {
    render(<AlertCard>Responsável (aluno menor de idade)</AlertCard>)
    expect(screen.getByText('Responsável (aluno menor de idade)')).toBeInTheDocument()
  })

  it('defaults to the warning tone', () => {
    const { container } = render(<AlertCard>Aviso</AlertCard>)
    expect(container.querySelector('.alert-card--warning')).toBeInTheDocument()
  })

  it.each(['warning', 'danger', 'info', 'success'] as const)(
    'applies the alert-card--%s class for that tone',
    (tone) => {
      const { container } = render(<AlertCard tone={tone}>Aviso</AlertCard>)
      expect(container.querySelector(`.alert-card--${tone}`)).toBeInTheDocument()
    },
  )

  it('renders as a non-interactive <div>', () => {
    const { container } = render(<AlertCard>Aviso</AlertCard>)
    expect(container.querySelector('div.alert-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })
})
