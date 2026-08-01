import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Medal, type MedalTier } from './Medal'

const TIERS: MedalTier[] = ['bronze', 'prata', 'ouro', 'platina', 'diamante']

describe('Medal', () => {
  it('renders with role="img" and an aria-label announcing the full tier name, not the abbreviation', () => {
    render(<Medal tier="ouro" />)
    expect(screen.getByRole('img', { name: 'Medalha Ouro' })).toBeInTheDocument()
  })

  it('always shows the visible abbreviation too — color is never the only signal', () => {
    render(<Medal tier="platina" />)
    expect(screen.getByText('Pt')).toBeInTheDocument()
  })

  it.each([
    ['bronze', 'B'],
    ['prata', 'P'],
    ['ouro', 'O'],
    ['platina', 'Pt'],
    ['diamante', 'D'],
  ] as [MedalTier, string][])('shows abbreviation %s -> %s and is aria-hidden', (tier, letter) => {
    render(<Medal tier={tier} />)
    const medal = screen.getByRole('img', { name: `Medalha ${tier.charAt(0).toUpperCase()}${tier.slice(1)}` })
    const glyph = medal.querySelector('.medal__letter')
    expect(glyph).toHaveTextContent(letter)
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(['sm', 'md', 'lg'] as const)('applies the size modifier class for size=%s', (size) => {
    render(<Medal tier="bronze" size={size} />)
    expect(screen.getByRole('img', { name: 'Medalha Bronze' }).className).toContain(`medal--${size}`)
  })

  it('defaults to size=sm when no size is given', () => {
    render(<Medal tier="bronze" />)
    expect(screen.getByRole('img', { name: 'Medalha Bronze' }).className).toContain('medal--sm')
  })

  it('is not focusable/interactive — no tabIndex', () => {
    render(<Medal tier="bronze" />)
    expect(screen.getByRole('img', { name: 'Medalha Bronze' })).not.toHaveAttribute('tabindex')
  })

  it.each(TIERS)('CSS: %s uses the -soft/-strong/-text token trio, never the base gamification token', (tier) => {
    const css = readFileSync('src/components/ui/Medal/Medal.css', 'utf8')
    const tierBlock = new RegExp(`\\.medal--${tier}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
    expect(tierBlock).toMatch(new RegExp(`background:\\s*var\\(--gamification-${tier}-soft\\)`))
    expect(tierBlock).toMatch(new RegExp(`border-color:\\s*var\\(--gamification-${tier}-strong\\)`))

    const letterBlock = new RegExp(`\\.medal--${tier} \\.medal__letter\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
    expect(letterBlock).toMatch(new RegExp(`color:\\s*var\\(--gamification-${tier}-text\\)`))

    // The base token (no -soft/-strong/-text suffix) must never appear as this
    // tier's stroke or text color — only AvatarBadge's solid+white-glyph fill
    // may consume it (contrast fails otherwise, see Medal.tsx doc comment).
    expect(tierBlock).not.toMatch(new RegExp(`var\\(--gamification-${tier}\\)`))
    expect(letterBlock).not.toMatch(new RegExp(`var\\(--gamification-${tier}\\)`))
  })

  // Eixo de POSIÇÃO (prop `place`) — o que faltava para Rankings consumir o
  // componente. O eixo de tier acima continua intacto (D1Dashboard).
  it.each([
    [1, '🥇'],
    [2, '🥈'],
    [3, '🥉'],
  ] as const)('place=%s draws %s and announces the ordinal, not a tier name', (place, glyph) => {
    render(<Medal place={place} />)
    const medal = screen.getByRole('img', { name: `${place}º lugar` })
    expect(medal).toHaveTextContent(glyph)
    expect(medal.className).toContain('medal--place')
  })

  it('the place variant carries no tier class, so it never picks up the circle', () => {
    render(<Medal place={1} />)
    const medal = screen.getByRole('img', { name: '1º lugar' })
    expect(medal.className).not.toMatch(/medal--(bronze|prata|ouro|platina|diamante|sm|md|lg)\b/)
    expect(medal.querySelector('.medal__letter')).not.toBeInTheDocument()
  })

  it('accepts a className on the place variant too', () => {
    render(<Medal place={2} className="x-custom" />)
    expect(screen.getByRole('img', { name: '2º lugar' }).className).toContain('x-custom')
  })

  it('CSS: the place variant resets the circle so it flows as inline text', () => {
    const css = readFileSync('src/components/ui/Medal/Medal.css', 'utf8')
    const block = /\.medal--place\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(block).toMatch(/display:\s*inline\b/)
    expect(block).toMatch(/border:\s*0/)
    expect(block).toMatch(/background:\s*none/)
  })

  it('CSS: no hex color literals (tokens only)', () => {
    const css = readFileSync('src/components/ui/Medal/Medal.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: sizes match Small 32 / Medium 48 / Large 64 per Figma node 196:32', () => {
    const css = readFileSync('src/components/ui/Medal/Medal.css', 'utf8')
    expect(css).toMatch(/\.medal--sm\s*\{[^}]*width:\s*32px/)
    expect(css).toMatch(/\.medal--md\s*\{[^}]*width:\s*48px/)
    expect(css).toMatch(/\.medal--lg\s*\{[^}]*width:\s*64px/)
  })
})
