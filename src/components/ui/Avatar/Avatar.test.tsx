import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'
import { AvatarIndicator } from './AvatarIndicator'
import { AvatarBadge } from './AvatarBadge'

describe('Avatar', () => {
  it('renders a neutral fallback silhouette (aria-hidden) when no name and no src are given', () => {
    const { container } = render(<Avatar />)
    expect(container.querySelector('.avatar--fallback')).toBeInTheDocument()
    expect(container.querySelector('.avatar__fallback')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders initials from a two-word name', () => {
    render(<Avatar name="Ana Silva" />)
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('renders initials from a single-word name (first two letters)', () => {
    render(<Avatar name="Bruno" />)
    expect(screen.getByText('BR')).toBeInTheDocument()
  })

  it('exposes the full name (never the initials) as the accessible name', () => {
    render(<Avatar name="Ana Silva" />)
    expect(screen.getByRole('img', { name: 'Ana Silva' })).toBeInTheDocument()
  })

  it('renders an <img> with the given src', () => {
    render(<Avatar name="Ana Silva" src="https://example.com/ana.png" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/ana.png')
    expect(img).toHaveAttribute('alt', 'Ana Silva')
  })

  it('uses alt="" (never "?") when src is given without a name', () => {
    const { container } = render(<Avatar src="https://example.com/anon.png" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
  })

  it('applies the discrete size class matching the size prop', () => {
    const { container } = render(<Avatar name="Ana Silva" size="xl" />)
    expect(container.querySelector('.avatar--xl')).toBeInTheDocument()
  })

  it('defaults to size="md" when no size is given', () => {
    const { container } = render(<Avatar name="Ana Silva" />)
    expect(container.querySelector('.avatar--md')).toBeInTheDocument()
  })

  it('assigns the same cyclic color for the same name deterministically', () => {
    const { unmount } = render(<Avatar name="Carlos" />)
    const first = screen.getByText('CA').style.getPropertyValue('--avatar-color')
    unmount()
    render(<Avatar name="Carlos" />)
    const second = screen.getByText('CA').style.getPropertyValue('--avatar-color')
    expect(first).toBe(second)
    expect(first).toMatch(/^var\(--sport-[a-z-]+\)$/)
  })

  it('does not throw for an arbitrary/unusual name', () => {
    expect(() => render(<Avatar name="日本語 テスト" />)).not.toThrow()
  })

  it('renders the indicator prop in the bottom-right slot', () => {
    const { container } = render(<Avatar name="Ana Silva" indicator={<AvatarIndicator status="online" />} />)
    const slot = container.querySelector('.avatar__indicator')
    expect(slot).toBeInTheDocument()
    expect(slot?.querySelector('.avatar-indicator--online')).toBeInTheDocument()
  })

  it('renders the badge prop in the top-right slot', () => {
    const { container } = render(<Avatar name="Ana Silva" badge={<AvatarBadge type="professor" label="Professor" />} />)
    const slot = container.querySelector('.avatar__badge')
    expect(slot).toBeInTheDocument()
    expect(slot?.querySelector('.avatar-badge--professor')).toBeInTheDocument()
  })

  it('CSS: sizes via discrete classes, no free-form pixel props, no hex literals', () => {
    const css = readFileSync('src/components/ui/Avatar/Avatar.css', 'utf8')
    expect(css).toMatch(/\.avatar--xs/)
    expect(css).toMatch(/\.avatar--xl/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
