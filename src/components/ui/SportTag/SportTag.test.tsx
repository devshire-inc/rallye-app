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
    const tag = screen.getByText(sportLabel('beach_tennis'))
    expect(tag.style.getPropertyValue('--tag-color')).toBe(`var(${sportCssVar('beach_tennis')})`)
  })

  it('falls back to --border-default for an unknown sport, without throwing', () => {
    render(<SportTag sport="krav-maga" />)
    const tag = screen.getByText('krav-maga')
    expect(tag.style.getPropertyValue('--tag-color')).toBe('var(--border-default)')
  })

  it('renders for every canonical sport slug without throwing', () => {
    const slugs = ['beach_tennis', 'padel', 'futevolei', 'volei', 'tenis', 'outro']
    for (const slug of slugs) {
      render(<SportTag sport={slug} />)
      expect(screen.getByText(sportLabel(slug))).toBeInTheDocument()
    }
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
})
