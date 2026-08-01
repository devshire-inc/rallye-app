import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageLoading } from './PageLoading'

describe('PageLoading', () => {
  it('announces the load once, via a single aria-live region', () => {
    render(<PageLoading label="Carregando horários" />)
    const liveRegions = screen.getAllByRole('status')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).toHaveTextContent('Carregando horários')
    expect(liveRegions[0]).toHaveAttribute('aria-live', 'polite')
  })

  it('marks the block stack aria-hidden — the announcement is the only thing read', () => {
    const { container } = render(<PageLoading label="Carregando" />)
    expect(container.querySelector('.page-loading')).toHaveAttribute('aria-hidden', 'true')
  })

  it('variant="page" (default) renders the title block, per the Figma stack', () => {
    const { container } = render(<PageLoading label="Carregando" />)
    expect(container.querySelector('.page-loading')).toHaveClass('page-loading--page')
    expect(container.querySelectorAll('.page-loading__title')).toHaveLength(1)
  })

  it('variant="section" drops the title block — the real page header is already visible', () => {
    const { container } = render(<PageLoading label="Carregando" variant="section" />)
    expect(container.querySelector('.page-loading')).toHaveClass('page-loading--section')
    expect(container.querySelectorAll('.page-loading__title')).toHaveLength(0)
    // o resto da pilha continua
    expect(container.querySelectorAll('.page-loading__filter')).toHaveLength(1)
    expect(container.querySelectorAll('.page-loading__banner')).toHaveLength(1)
  })

  it('renders 2 rows of 2 tiles by default (Figma node 187:7283/187:7286)', () => {
    const { container } = render(<PageLoading label="Carregando" />)
    expect(container.querySelectorAll('.page-loading__row')).toHaveLength(2)
    expect(container.querySelectorAll('.page-loading__tile')).toHaveLength(4)
  })

  it('honors a custom `rows` count', () => {
    const { container } = render(<PageLoading label="Carregando" rows={4} />)
    expect(container.querySelectorAll('.page-loading__row')).toHaveLength(4)
    expect(container.querySelectorAll('.page-loading__tile')).toHaveLength(8)
  })

  it('every block carries skeleton__shape, so it inherits the surface/shimmer treatment', () => {
    const { container } = render(<PageLoading label="Carregando" />)
    const blocks = container.querySelectorAll(
      '.page-loading__title, .page-loading__filter, .page-loading__banner, .page-loading__tile',
    )
    expect(blocks.length).toBe(7)
    blocks.forEach((block) => expect(block).toHaveClass('skeleton__shape'))
  })

  it('variant="list" renders 4 tableRow skeletons by default, under one announcement', () => {
    const { container } = render(<PageLoading label="Carregando membros" variant="list" />)
    expect(container.querySelectorAll('.skeleton--tableRow')).toHaveLength(4)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    // sem os blocos genéricos — a forma aqui é a da lista
    expect(container.querySelectorAll('.page-loading__banner')).toHaveLength(0)
  })

  it('variant="list" honors a custom `rows` count', () => {
    const { container } = render(<PageLoading label="Carregando" variant="list" rows={6} />)
    expect(container.querySelectorAll('.skeleton--tableRow')).toHaveLength(6)
  })

  it('CSS: variant="list" stretches the tableRow skeleton to the full column width', () => {
    const css = readFileSync('src/components/ui/PageLoading/PageLoading.css', 'utf8')
    expect(css).toMatch(/\.page-loading--list \.skeleton--tableRow\s*{[^}]*width:\s*100%/)
  })

  it('variant="field" renders a single control-height block', () => {
    const { container } = render(<PageLoading label="Carregando quadras" variant="field" />)
    expect(container.querySelectorAll('.page-loading__filter')).toHaveLength(1)
    expect(container.querySelectorAll('.page-loading__banner')).toHaveLength(0)
    expect(container.querySelectorAll('.page-loading__tile')).toHaveLength(0)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('accepts an extra className on the root', () => {
    const { container } = render(<PageLoading label="Carregando" className="custom" />)
    expect(container.querySelector('.page-loading')).toHaveClass('custom')
  })

  it('CSS: block heights match the Figma spec, radii come from the DS scale, no hex literals', () => {
    const css = readFileSync('src/components/ui/PageLoading/PageLoading.css', 'utf8')
    expect(css).toMatch(/\.page-loading__title\s*{[^}]*height:\s*28px/)
    expect(css).toMatch(/\.page-loading__title\s*{[^}]*width:\s*180px/)
    expect(css).toMatch(/\.page-loading__filter\s*{[^}]*height:\s*40px/)
    expect(css).toMatch(/\.page-loading__filter\s*{[^}]*border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/\.page-loading__banner\s*{[^}]*height:\s*64px/)
    expect(css).toMatch(/\.page-loading__tile\s*{[^}]*height:\s*80px/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: spacing and radii go through tokens, never raw px', () => {
    const css = readFileSync('src/components/ui/PageLoading/PageLoading.css', 'utf8')
    expect(css).toMatch(/gap:\s*var\(--space-3\)/)
    expect(css).not.toMatch(/border-radius:\s*\d+px/)
    expect(css).not.toMatch(/gap:\s*\d+px/)
  })
})
