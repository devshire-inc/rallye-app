import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EVENT_STATUS_LABEL, EventStatusBadge } from './EventStatusBadge'

describe('EventStatusBadge', () => {
  it('imports the real Badge component — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/EventStatusBadge/EventStatusBadge.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it.each([
    ['convite', 'badge--info'],
    ['inscrito', 'badge--success'],
    ['abertas', 'badge--brand'],
    ['lotado', 'badge--warning'],
    ['encerrado', 'badge--neutral'],
  ] as const)('maps status=%s to Badge tone %s', (status, toneClass) => {
    render(<EventStatusBadge status={status} />)
    expect(screen.getByText(EVENT_STATUS_LABEL[status]).className).toContain(toneClass)
  })

  it.each([
    ['convite', 'VOCÊ FOI CONVIDADO'],
    ['inscrito', 'INSCRITO'],
    ['abertas', 'INSCRIÇÕES ABERTAS'],
    ['lotado', 'LOTADO'],
    ['encerrado', 'ENCERRADO'],
  ] as const)('renders the correct label for status=%s', (status, label) => {
    render(<EventStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('CSS: overrides Badge typography to Overline and removes the border, scoped to .event-status-badge', () => {
    const css = readFileSync('src/components/ui/EventStatusBadge/EventStatusBadge.css', 'utf8')
    expect(css).toMatch(/\.event-status-badge \.badge\s*{[^}]*font:\s*var\(--type-overline\)/)
    expect(css).toMatch(/\.event-status-badge \.badge\s*{[^}]*border:\s*none/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
