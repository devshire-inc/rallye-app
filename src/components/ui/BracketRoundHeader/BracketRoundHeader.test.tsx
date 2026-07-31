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
