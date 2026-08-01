import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BREAKPOINT_DAYUSE_FORM_STACK_MAX,
  BREAKPOINT_SHELL_DESKTOP_MIN,
  BREAKPOINT_TABLE_MIN,
  BREAKPOINT_TABLET_MIN,
  BREAKPOINT_TOURNAMENT_FORM_COMPACT_MAX,
  BREAKPOINT_VITE_TEMPLATE_MAX,
} from './breakpoints'

describe('breakpoints.ts', () => {
  it('preserves the exact ad hoc pixel values already in production CSS', () => {
    expect(BREAKPOINT_TABLET_MIN).toBe(640)
    expect(BREAKPOINT_SHELL_DESKTOP_MIN).toBe(860)
    expect(BREAKPOINT_VITE_TEMPLATE_MAX).toBe(1024)
    expect(BREAKPOINT_DAYUSE_FORM_STACK_MAX).toBe(620)
    expect(BREAKPOINT_TOURNAMENT_FORM_COMPACT_MAX).toBe(480)
  })

  it('keeps the desktop-table swap above the shell breakpoint', () => {
    // Medido, não arbitrado: 820px de coluna de conteúdo (o `min-width` da
    // tabela de 5 colunas) + 400px de cromo do shell. Ver o comentário da
    // constante. Se a tabela trocasse no breakpoint do shell (860), ela
    // nasceria com rolagem horizontal.
    expect(BREAKPOINT_TABLE_MIN).toBe(1220)
    expect(BREAKPOINT_TABLE_MIN).toBeGreaterThan(BREAKPOINT_SHELL_DESKTOP_MIN)
  })
})

describe('CSS @media queries reference breakpoints.ts as the canonical source', () => {
  const cases = [
    { file: 'src/App.css', px: '1024px' },
    { file: 'src/components/AppShell/AppShell.css', px: '860px' },
    // S1Page.css deixou de citar 640px quando o reskin do Figma trocou o grid
    // de 2 colunas por uma lista de 1 coluna; o consumidor real de
    // BREAKPOINT_TABLET_MIN hoje é o TimePicker do design system.
    { file: 'src/components/ui/TimePicker/TimePicker.css', px: '640px' },
    { file: 'src/pages/DayUse/DayUseConfigPage.css', px: '620px' },
    { file: 'src/pages/Tournaments/TournamentFormPage.css', px: '480px' },
    { file: 'src/pages/Financeiro/Financeiro.css', px: '1220px' },
    { file: 'src/styles/utilities.css', px: '1220px' },
  ]

  it.each(cases)('$file mentions breakpoints.ts near its $px query', ({ file, px }) => {
    const source = readFileSync(file, 'utf8')
    expect(source).toContain(px)
    expect(source).toContain('breakpoints.ts')
  })
})
