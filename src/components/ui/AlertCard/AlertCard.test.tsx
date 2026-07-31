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

  it('does not render an icon slot by default', () => {
    const { container } = render(<AlertCard>Aviso</AlertCard>)
    expect(container.querySelector('.alert-card__icon')).not.toBeInTheDocument()
  })

  it.each(['warning', 'danger', 'info', 'success'] as const)(
    'renders the default icon for the %s tone when showIcon is set',
    (tone) => {
      const { container } = render(
        <AlertCard tone={tone} showIcon>
          Aviso
        </AlertCard>,
      )
      const iconSlot = container.querySelector('.alert-card__icon')
      expect(iconSlot).toBeInTheDocument()
      expect(iconSlot?.querySelector('.icon svg')).toBeInTheDocument()
    },
  )

  it('renders a custom icon when the icon prop is passed, ignoring showIcon default', () => {
    render(
      <AlertCard icon={<span data-testid="custom-icon">★</span>}>
        Aviso
      </AlertCard>,
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('lets the icon prop override the automatic showIcon icon', () => {
    render(
      <AlertCard showIcon icon={<span data-testid="custom-icon">★</span>}>
        Aviso
      </AlertCard>,
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})
