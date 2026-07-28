import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BREAKPOINT_DAYUSE_FORM_STACK_MAX,
  BREAKPOINT_SHELL_DESKTOP_MIN,
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
})

describe('CSS @media queries reference breakpoints.ts as the canonical source', () => {
  const cases = [
    { file: 'src/App.css', px: '1024px' },
    { file: 'src/components/AppShell/AppShell.css', px: '860px' },
    { file: 'src/pages/S1Page.css', px: '640px' },
    { file: 'src/pages/DayUse/DayUseConfigPage.css', px: '620px' },
    { file: 'src/pages/Tournaments/TournamentFormPage.css', px: '480px' },
  ]

  it.each(cases)('$file mentions breakpoints.ts near its $px query', ({ file, px }) => {
    const source = readFileSync(file, 'utf8')
    expect(source).toContain(px)
    expect(source).toContain('breakpoints.ts')
  })
})
