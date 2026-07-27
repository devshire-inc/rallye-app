import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders "?" as initials when no name and no src are given', () => {
    render(<Avatar />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders initials from a two-word name', () => {
    render(<Avatar name="Ana Silva" />)
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('renders initials from a single-word name (first two letters)', () => {
    render(<Avatar name="Bruno" />)
    expect(screen.getByText('BR')).toBeInTheDocument()
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

  it('sets --avatar-size from the size prop', () => {
    render(<Avatar name="Ana Silva" size={64} />)
    const avatar = screen.getByText('AS')
    expect(avatar.style.getPropertyValue('--avatar-size')).toBe('64px')
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

  it('CSS: dynamic sizing via --avatar-size custom property, no hex literals', () => {
    const css = readFileSync('src/components/ui/Avatar/Avatar.css', 'utf8')
    expect(css).toMatch(/var\(--avatar-size\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
