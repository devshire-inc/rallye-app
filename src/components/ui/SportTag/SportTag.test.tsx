import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sportCssVar, sportLabel } from '../../../lib/sports'
import { SportTag } from './SportTag'

describe('SportTag', () => {
  it('defaults its label to sportLabel(sport)', () => {
    render(<SportTag sport="padel" />)
    expect(screen.getByText(sportLabel('padel'))).toBeInTheDocument()
  })

  it('renders custom children instead of the default label when provided', () => {
    render(<SportTag sport="padel">Padel (2v2)</SportTag>)
    expect(screen.getByText('Padel (2v2)')).toBeInTheDocument()
  })

  it('sets --tag-color to var(<sportCssVar>) for a known sport', () => {
    render(<SportTag sport="beach_tennis" />)
    const tag = screen.getByText(sportLabel('beach_tennis')).closest('.sport-tag')
    expect(tag).not.toBeNull()
    expect((tag as HTMLElement).style.getPropertyValue('--tag-color')).toBe(
      `var(${sportCssVar('beach_tennis')})`,
    )
  })

  it('falls back to --border-default for an unknown sport, without throwing', () => {
    render(<SportTag sport="krav-maga" />)
    const tag = screen.getByText('krav-maga').closest('.sport-tag')
    expect(tag).not.toBeNull()
    expect((tag as HTMLElement).style.getPropertyValue('--tag-color')).toBe('var(--border-default)')
  })

  it('renders for every canonical sport slug without throwing', () => {
    const slugs = ['beach_tennis', 'padel', 'futevolei', 'volei', 'tenis', 'outro']
    for (const slug of slugs) {
      render(<SportTag sport={slug} />)
      expect(screen.getByText(sportLabel(slug))).toBeInTheDocument()
    }
  })

  it('applies the solid modifier class only when solid is true', () => {
    const { rerender } = render(<SportTag sport="padel" />)
    expect(screen.getByText(sportLabel('padel')).className).not.toContain('sport-tag--solid')

    rerender(<SportTag sport="padel" solid />)
    expect(screen.getByText(sportLabel('padel')).className).toContain('sport-tag--solid')
  })

  it('renders an aria-hidden dot alongside the label', () => {
    render(<SportTag sport="padel" />)
    const tag = screen.getByText(sportLabel('padel')).closest('.sport-tag') as HTMLElement
    const dot = tag.querySelector('.sport-tag__dot')
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })

  it('imports sportLabel/sportCssVar from lib/sports — no parallel color/label map', () => {
    const source = readFileSync('src/components/ui/SportTag/SportTag.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/\.\.\/\.\.\/lib\/sports['"]/)
  })

  it('CSS: dynamic color via --tag-color custom property, no hex literals', () => {
    const css = readFileSync('src/components/ui/SportTag/SportTag.css', 'utf8')
    expect(css).toMatch(/var\(--tag-color\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: soft (default) background is a 14% color-mix of --tag-color, per Figma; solid uses a full --tag-color fill', () => {
    const css = readFileSync('src/components/ui/SportTag/SportTag.css', 'utf8')
    expect(css).toMatch(/background:\s*color-mix\(in srgb, var\(--tag-color\) 14%, transparent\)/)
    const solidBlockMatch = css.match(/\.sport-tag--solid\s*{([^}]*)}/)
    expect(solidBlockMatch).not.toBeNull()
    expect(solidBlockMatch![1]).toMatch(/background:\s*var\(--tag-color\)/)
    expect(solidBlockMatch![1]).toMatch(/color:\s*var\(--text-on-brand\)/)
  })

  it('CSS: height, padding, radius, font per spec', () => {
    const css = readFileSync('src/components/ui/SportTag/SportTag.css', 'utf8')
    expect(css).toMatch(/height:\s*26px/)
    expect(css).toMatch(/padding:\s*0 var\(--space-3\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/font:\s*var\(--type-label\)/)
  })

  it('CSS: dot is an 8px circle that follows the current text color', () => {
    const css = readFileSync('src/components/ui/SportTag/SportTag.css', 'utf8')
    const dotBlockMatch = css.match(/\.sport-tag__dot\s*{([^}]*)}/)
    expect(dotBlockMatch).not.toBeNull()
    expect(dotBlockMatch![1]).toMatch(/width:\s*8px/)
    expect(dotBlockMatch![1]).toMatch(/height:\s*8px/)
    expect(dotBlockMatch![1]).toMatch(/background:\s*currentColor/)
  })
})
