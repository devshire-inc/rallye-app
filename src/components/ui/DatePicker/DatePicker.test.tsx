import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker, formatIsoLocal, parseIsoLocal } from './DatePicker'

const FIXED_MIN = '2020-01-01'

function dayButton(day: number) {
  return screen.getByRole('button', { name: new RegExp(`, ${day} de `) })
}

describe('parseIsoLocal', () => {
  it('parses a valid ISO date without any timezone shift', () => {
    const date = parseIsoLocal('2024-02-28')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2024)
    expect(date!.getMonth()).toBe(1)
    expect(date!.getDate()).toBe(28)
  })

  it('rejects a roundtrip-impossible date (2026-02-30)', () => {
    expect(parseIsoLocal('2026-02-30')).toBeNull()
  })

  it('rejects malformed strings', () => {
    expect(parseIsoLocal('not-a-date')).toBeNull()
    expect(parseIsoLocal('2024-2-28')).toBeNull()
    expect(parseIsoLocal('')).toBeNull()
    expect(parseIsoLocal('2024/02/28')).toBeNull()
  })

  it('accepts a leap-year Feb 29 and rejects it on a non-leap year', () => {
    expect(parseIsoLocal('2024-02-29')).not.toBeNull()
    expect(parseIsoLocal('2023-02-29')).toBeNull()
  })
})

describe('formatIsoLocal', () => {
  it('zero-pads month and day', () => {
    expect(formatIsoLocal(new Date(2024, 1, 5))).toBe('2024-02-05')
  })

  it('round-trips through parseIsoLocal', () => {
    const iso = '2024-11-03'
    expect(formatIsoLocal(parseIsoLocal(iso)!)).toBe(iso)
  })

  it('never calls toISOString (no UTC shift risk)', () => {
    const source = readFileSync('src/components/ui/DatePicker/DatePicker.tsx', 'utf8')
    expect(source).not.toMatch(/toISOString/)
  })
})

describe('DatePicker — min defaulting', () => {
  it('defaults min to today: disables yesterday, enables today (same-month case)', () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (yesterday.getMonth() !== today.getMonth()) return

    render(<DatePicker />)
    expect(dayButton(today.getDate())).not.toBeDisabled()
    expect(dayButton(yesterday.getDate())).toBeDisabled()
  })

  it('falls back to today when min is an invalid string (same-month case)', () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (yesterday.getMonth() !== today.getMonth()) return

    render(<DatePicker min="not-a-date" />)
    expect(dayButton(today.getDate())).not.toBeDisabled()
    expect(dayButton(yesterday.getDate())).toBeDisabled()
  })

  it('disables every day before an explicit valid min, enables from min onward', () => {
    render(<DatePicker value="2024-02-15" min="2024-02-10" />)
    expect(dayButton(9)).toBeDisabled()
    expect(dayButton(10)).not.toBeDisabled()
    expect(dayButton(15)).not.toBeDisabled()
  })
})

describe('DatePicker — busyDates (decorative only, never disables)', () => {
  it('does not disable a busy day, adds ", ocupado" to its aria-label, and renders an aria-hidden dot', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} busyDates={['2024-02-15']} />)
    const button = dayButton(15)
    expect(button).not.toBeDisabled()
    expect(button.getAttribute('aria-label')).toMatch(/ocupado$/)
    expect(button.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('a non-busy day has no ", ocupado" suffix', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} busyDates={['2024-02-15']} />)
    expect(dayButton(16).getAttribute('aria-label')).not.toMatch(/ocupado/)
  })

  it('ignores invalid entries in busyDates without throwing', () => {
    expect(() =>
      render(
        <DatePicker
          value="2024-02-15"
          min={FIXED_MIN}
          busyDates={['not-a-date', '2024-02-30', '2024-02-15']}
        />,
      ),
    ).not.toThrow()
    expect(dayButton(15).getAttribute('aria-label')).toMatch(/ocupado$/)
  })
})

describe('DatePicker — day button semantics', () => {
  it('uses aria-pressed (not aria-selected) to mark the selected day', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    const selected = dayButton(15)
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).not.toHaveAttribute('aria-selected')
    expect(dayButton(16)).toHaveAttribute('aria-pressed', 'false')
  })

  it('has a full pt-BR date name via Intl.DateTimeFormat', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    const expected = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    }).format(new Date(2024, 1, 15))
    expect(dayButton(15)).toHaveAttribute('aria-label', expected)
  })

  it('calls onChange with the ISO date when an enabled day is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} onChange={onChange} />)
    await user.click(dayButton(20))
    expect(onChange).toHaveBeenCalledWith('2024-02-20')
  })
})

describe('DatePicker — keyboard navigation & focus', () => {
  it('disabled days are never focus targets (tabIndex -1) and cannot be activated', async () => {
    render(<DatePicker value="2024-02-15" min="2024-02-10" />)
    const disabledDay = dayButton(9)
    expect(disabledDay).toHaveAttribute('tabIndex', '-1')
    expect(disabledDay).toBeDisabled()
  })

  it('ArrowRight moves the roving tabindex forward one day, crossing into the next month', async () => {
    const user = userEvent.setup()
    // 2023 is not a leap year — Feb 28 is the last day, so ArrowRight crosses into March.
    render(<DatePicker value="2023-02-28" min={FIXED_MIN} />)
    dayButton(28).focus()
    await user.keyboard('{ArrowRight}')
    const marchFirst = await screen.findByRole('button', { name: /, 1 de março/ })
    expect(marchFirst).toHaveFocus()
  })

  it('ArrowLeft moves backward one day, crossing into the previous month', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2024-03-01" min={FIXED_MIN} />)
    dayButton(1).focus()
    await user.keyboard('{ArrowLeft}')
    const febLast = await screen.findByRole('button', { name: /, 29 de fevereiro/ })
    expect(febLast).toHaveFocus()
  })

  it('ArrowDown/ArrowUp move by 7 days', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-10" min={FIXED_MIN} />)
    dayButton(10).focus()
    await user.keyboard('{ArrowDown}')
    expect(dayButton(17)).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{ArrowUp}')
    expect(dayButton(3)).toHaveFocus()
  })

  it('Home/End move to the first/last day of the displayed month', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    dayButton(15).focus()
    await user.keyboard('{End}')
    expect(dayButton(29)).toHaveFocus()
    await user.keyboard('{Home}')
    expect(dayButton(1)).toHaveFocus()
  })

  it('never focuses before min: Home/ArrowLeft clamp at the min date instead of an earlier disabled day', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-15" min="2024-02-10" />)
    dayButton(15).focus()
    await user.keyboard('{Home}')
    expect(dayButton(10)).toHaveFocus()
    expect(dayButton(10)).not.toBeDisabled()
  })

  it('Enter/Space select the currently focused enabled day', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} onChange={onChange} />)
    dayButton(15).focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('2024-02-16')
  })

  it('when the whole displayed month is disabled, no day cell has tabIndex=0 — only month nav is focusable', () => {
    const now = new Date()
    const farFutureMin = new Date(now.getFullYear(), now.getMonth() + 2, 1)
    render(<DatePicker min={formatIsoLocal(farFutureMin)} />)
    const dayCells = screen
      .getAllByRole('button')
      .filter((button) => /, \d+ de \w+ de \d{4}$/.test(button.getAttribute('aria-label') ?? ''))
    for (const cell of dayCells) {
      expect(cell).toHaveAttribute('tabIndex', '-1')
    }
    expect(screen.getByRole('button', { name: /Mês anterior|anterior/i })).not.toHaveAttribute(
      'tabIndex',
      '-1',
    )
  })
})

describe('DatePicker — month navigation buttons', () => {
  it('prev/next month buttons have descriptive aria-labels naming the target month', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    const next = screen.getByRole('button', { name: /março/i })
    const prev = screen.getByRole('button', { name: /janeiro/i })
    expect(next).toBeInTheDocument()
    expect(prev).toBeInTheDocument()
    await user.click(next)
    expect(screen.getByRole('button', { name: /, 1 de março/ })).toBeInTheDocument()
  })
})

describe('DatePicker — today marker', () => {
  it('marks today\'s cell with aria-current="date" when visible', () => {
    const now = new Date()
    render(<DatePicker value={formatIsoLocal(now)} min={FIXED_MIN} />)
    expect(dayButton(now.getDate())).toHaveAttribute('aria-current', 'date')
  })
})

describe('DatePicker — theming and tokens', () => {
  it('never uses the legacy --ink token', () => {
    const css = readFileSync('src/components/ui/DatePicker/DatePicker.css', 'utf8')
    expect(css).not.toMatch(/--ink\b/)
  })

  it('uses --interactive-primary/--text-on-brand for the selected day, not a hex literal', () => {
    const css = readFileSync('src/components/ui/DatePicker/DatePicker.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('renders without throwing regardless of the light/dark data-theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(() => render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)).not.toThrow()
    document.documentElement.removeAttribute('data-theme')
  })
})

describe('DatePicker — Figma parity (node 47:6 "Mobile — Full-width")', () => {
  it('renders the header without the "de" connector Intl normally inserts, e.g. "Fevereiro 2024"', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    expect(screen.getByText('Fevereiro 2024')).toBeInTheDocument()
  })

  it('the busy-date dot uses --interactive-primary (same orange as "selected"), per the canvas doc: "Ponto laranja = data ocupada; laranja sólido = selecionada"', () => {
    const css = readFileSync('src/components/ui/DatePicker/DatePicker.css', 'utf8')
    expect(css).toMatch(/\.date-picker__busy-dot\s*\{[^}]*background:\s*var\(--interactive-primary\)/)
  })

  it('weekday header shows a single visible letter per day (D S T Q Q S S, node 47:8) but exposes the full weekday name to assistive tech', () => {
    render(<DatePicker value="2024-02-15" min={FIXED_MIN} />)
    expect(screen.getByText('Domingo')).toBeInTheDocument()
    expect(screen.getByText('Sábado')).toBeInTheDocument()
    expect(screen.getAllByText('Q')).toHaveLength(2) // Quarta + Quinta share the visible glyph
  })

  it('each size variant maps to its own --date-picker-cell-size custom property', () => {
    const css = readFileSync('src/components/ui/DatePicker/DatePicker.css', 'utf8')
    expect(css).toMatch(/\.date-picker--sm\s*\{[^}]*--date-picker-cell-size:\s*28px/)
    expect(css).toMatch(/\.date-picker--md\s*\{[^}]*--date-picker-cell-size:\s*32px/)
    expect(css).toMatch(/\.date-picker--lg\s*\{[^}]*--date-picker-cell-size:\s*40px/)
  })

  it('marks today with a distinct class (date-picker__day--today) when it is not the selected day', () => {
    const now = new Date()
    render(<DatePicker min={FIXED_MIN} />)
    const today = dayButton(now.getDate())
    expect(today.className).toMatch(/date-picker__day--today/)
    expect(today.className).not.toMatch(/date-picker__day--selected/)
  })

  it('does not apply the --today class when today is also the selected day (selected fill wins)', () => {
    const now = new Date()
    render(<DatePicker value={formatIsoLocal(now)} min={FIXED_MIN} />)
    const today = dayButton(now.getDate())
    expect(today.className).toMatch(/date-picker__day--selected/)
    expect(today.className).not.toMatch(/date-picker__day--today/)
  })
})
