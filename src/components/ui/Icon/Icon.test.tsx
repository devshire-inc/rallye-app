import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, ICON_NAMES, type IconName } from './Icon'

describe('Icon', () => {
  it.each(ICON_NAMES)('renders "%s" without throwing, as an inline <svg>', (name) => {
    const { container } = render(<Icon name={name} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders nothing for an unknown name instead of throwing', () => {
    const { container } = render(<Icon name={'not-a-real-icon' as IconName} />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(container.querySelector('.icon')).not.toBeInTheDocument()
  })

  it('is aria-hidden by default (decorative, paired with a visible text label)', () => {
    const { container } = render(<Icon name="home" />)
    expect(container.querySelector('.icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('can opt out of aria-hidden when the icon is the only accessible content', () => {
    const { container } = render(<Icon name="home" ariaHidden={false} />)
    expect(container.querySelector('.icon')).toHaveAttribute('aria-hidden', 'false')
  })

  it('defaults to a 24px box and honors a custom size via --icon-size', () => {
    const { container: defaultContainer } = render(<Icon name="home" />)
    expect(defaultContainer.querySelector('.icon')).toHaveStyle({ '--icon-size': '24px' })

    const { container: sizedContainer } = render(<Icon name="home" size={40} />)
    expect(sizedContainer.querySelector('.icon')).toHaveStyle({ '--icon-size': '40px' })
  })

  it('renders every icon as a single 24×24 stroke SVG with currentColor (no baked-in color)', () => {
    const { container } = render(<Icon name="settings" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
