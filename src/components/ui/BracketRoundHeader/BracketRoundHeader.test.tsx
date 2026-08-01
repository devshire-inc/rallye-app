import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BracketRoundHeader } from './BracketRoundHeader'

describe('BracketRoundHeader', () => {
  it('renders free-text round names, not a fixed enum', () => {
    render(<BracketRoundHeader round="Ronda de grupos" />)
    expect(screen.getByText('Ronda de grupos')).toBeInTheDocument()
  })

  it('renders the match count with correct singular/plural', () => {
    const { rerender } = render(<BracketRoundHeader round="Final" matchCount={1} />)
    expect(screen.getByText('1 jogo')).toBeInTheDocument()

    rerender(<BracketRoundHeader round="Oitavas" matchCount={8} />)
    expect(screen.getByText('8 jogos')).toBeInTheDocument()
  })

  it('renders the round name as a heading, defaulting to h3', () => {
    render(<BracketRoundHeader round="Semifinal" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Semifinal' })).toBeInTheDocument()
  })

  it('accepts a headingLevel override so it composes into an existing page hierarchy', () => {
    render(<BracketRoundHeader round="Semifinal" headingLevel={2} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Semifinal' })).toBeInTheDocument()
  })

  it('applies the highlighted treatment only when isFinal is true', () => {
    const { container, rerender } = render(<BracketRoundHeader round="Oitavas" />)
    expect(container.firstElementChild).not.toHaveClass('bracket-round-header--final')

    rerender(<BracketRoundHeader round="Final" isFinal />)
    expect(container.firstElementChild).toHaveClass('bracket-round-header--final')
  })

  // Variante `plain` — o cabeçalho de texto puro dos frames de Chave, que é o
  // que BracketPage consome. Aditiva: `pill` continua sendo o default.
  it('variant="plain" renders the heading alone, with no pill wrapper', () => {
    const { container } = render(<BracketRoundHeader round="Semifinal" variant="plain" headingLevel={2} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Semifinal' })
    expect(container.firstElementChild).toBe(heading)
    expect(container.querySelector('.bracket-round-header')).not.toBeInTheDocument()
    expect(heading).toHaveClass('bracket-round-header__name--plain')
  })

  it('variant="plain" keeps the id, so aria-labelledby still works', () => {
    render(<BracketRoundHeader round="Final" variant="plain" id="round-final" />)
    expect(screen.getByRole('heading', { name: 'Final' })).toHaveAttribute('id', 'round-final')
  })

  it('variant="plain" folds the match count into the heading instead of a second box', () => {
    render(<BracketRoundHeader round="Oitavas" matchCount={8} variant="plain" />)
    const heading = screen.getByRole('heading', { name: /Oitavas.*8 jogos/ })
    expect(heading).toHaveTextContent('Oitavas · 8 jogos')
    expect(heading.querySelector('.bracket-round-header__count')).toBeInTheDocument()
  })

  it('fluid releases the fixed 240px of the pill', () => {
    const { container, rerender } = render(<BracketRoundHeader round="Semifinal" />)
    expect(container.firstElementChild).not.toHaveClass('bracket-round-header--fluid')

    rerender(<BracketRoundHeader round="Semifinal" fluid />)
    expect(container.firstElementChild).toHaveClass('bracket-round-header--fluid')
  })

  it('CSS: plain is muted and fluid is 100%', () => {
    const css = readFileSync('src/components/ui/BracketRoundHeader/BracketRoundHeader.css', 'utf8')
    expect(css).toMatch(/\.bracket-round-header__name--plain\s*\{[^}]*color:\s*var\(--text-muted\)/)
    expect(css).toMatch(/\.bracket-round-header--fluid\s*\{[^}]*width:\s*100%/)
  })

  it('CSS: default uses surface/sunken, final uses surface/brand-soft + text/brand-strong, no hex literals', () => {
    const css = readFileSync('src/components/ui/BracketRoundHeader/BracketRoundHeader.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    const baseBlock = /^\.bracket-round-header\s*\{([^}]*)\}/m.exec(css)?.[1] ?? ''
    expect(baseBlock).toMatch(/background:\s*var\(--surface-sunken\)/)
    const finalBlock = /\.bracket-round-header--final\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(finalBlock).toMatch(/background:\s*var\(--surface-brand-soft\)/)
    const finalNameBlock = /\.bracket-round-header--final \.bracket-round-header__name\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(finalNameBlock).toMatch(/color:\s*var\(--text-brand-strong\)/)
  })
})
