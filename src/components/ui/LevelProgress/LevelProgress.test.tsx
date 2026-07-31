import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LevelProgress } from './LevelProgress'

describe('LevelProgress', () => {
  it('renders the visible criterion text', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias para o nível C" percent={68} currentLevel="D" nextLevel="C" />)
    expect(screen.getByText('Faltam 3 vitórias para o nível C')).toBeInTheDocument()
  })

  it('renders the visible percent text', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={68} currentLevel="D" nextLevel="C" />)
    expect(screen.getByText('68%')).toBeInTheDocument()
  })

  it('renders the current/next level footer texts', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={68} currentLevel="D" nextLevel="C" />)
    expect(screen.getByText('Nível atual: D')).toBeInTheDocument()
    expect(screen.getByText('Próximo: C')).toBeInTheDocument()
  })

  it('exposes a real role="progressbar" with aria-valuenow/min/max', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={68} currentLevel="D" nextLevel="C" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '68')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('associates the progressbar with the visible criterion text via aria-labelledby', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={68} currentLevel="D" nextLevel="C" />)
    const bar = screen.getByRole('progressbar')
    const labelledbyId = bar.getAttribute('aria-labelledby')
    expect(labelledbyId).toBeTruthy()
    expect(document.getElementById(labelledbyId!)).toHaveTextContent('Faltam 3 vitórias')
  })

  it('reflects percent changes in aria-valuenow, the visible %, and the fill width', () => {
    const { rerender } = render(
      <LevelProgress criterion="Faltam 3 vitórias" percent={20} currentLevel="D" nextLevel="C" />,
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar').style.getPropertyValue('--level-progress-percent')).toBe('20%')

    rerender(<LevelProgress criterion="Faltam 3 vitórias" percent={91} currentLevel="D" nextLevel="C" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '91')
    expect(screen.getByText('91%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar').style.getPropertyValue('--level-progress-percent')).toBe('91%')
  })

  it('clamps percent to [0, 100]', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={140} currentLevel="D" nextLevel="C" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    const { rerender } = render(
      <LevelProgress criterion="Faltam 3 vitórias" percent={140} currentLevel="D" nextLevel="C" />,
    )
    rerender(<LevelProgress criterion="Faltam 3 vitórias" percent={-10} currentLevel="D" nextLevel="C" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('is not focusable/interactive — no tabIndex on the progressbar (decorative, not a slider)', () => {
    render(<LevelProgress criterion="Faltam 3 vitórias" percent={68} currentLevel="D" nextLevel="C" />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('tabindex')
  })

  it('CSS: track uses surface/sunken and fill uses interactive/primary, no hex literals', () => {
    const css = readFileSync('src/components/ui/LevelProgress/LevelProgress.css', 'utf8')
    const trackBlock = /\.level-progress__track\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(trackBlock).toMatch(/background:\s*var\(--surface-sunken\)/)
    const fillBlock = /\.level-progress__fill\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(fillBlock).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: criterion text uses text/heading, percent and footer use text/muted', () => {
    const css = readFileSync('src/components/ui/LevelProgress/LevelProgress.css', 'utf8')
    const criterionBlock = /\.level-progress__criterion\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(criterionBlock).toMatch(/color:\s*var\(--text-heading\)/)
    const percentBlock = /\.level-progress__percent\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(percentBlock).toMatch(/color:\s*var\(--text-muted\)/)
    const footerBlock = /\.level-progress__footer\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(footerBlock).toMatch(/color:\s*var\(--text-muted\)/)
  })

  it('CSS: fill width reads from the --level-progress-percent custom property (legacy gate: no literal width in dynamic style)', () => {
    const css = readFileSync('src/components/ui/LevelProgress/LevelProgress.css', 'utf8')
    expect(css).toMatch(/width:\s*var\(--level-progress-percent,\s*0%\)/)

    const source = readFileSync('src/components/ui/LevelProgress/LevelProgress.tsx', 'utf8')
    expect(source).toMatch(/'--level-progress-percent'/)
  })
})
