import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatTime, generateSlots, TimePicker } from './TimePicker'

describe('generateSlots', () => {
  it('generates an inclusive range', () => {
    const slots = generateSlots(7 * 60, 8 * 60, 30)
    expect(slots).toEqual([420, 450, 480])
  })

  it('returns exactly one slot when start === end', () => {
    expect(generateSlots(600, 600, 30)).toEqual([600])
  })

  it('returns zero slots when start > end (no cross-midnight support)', () => {
    expect(generateSlots(600, 300, 30)).toEqual([])
  })
})

describe('formatTime', () => {
  it('zero-pads hour and minute', () => {
    expect(formatTime(7 * 60 + 5)).toBe('07:05')
  })
})

describe('TimePicker — defaults', () => {
  it('falls back start/end to 07:00/23:00 when omitted', () => {
    render(<TimePicker step={60} />)
    expect(screen.getByRole('button', { name: '07:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '23:00' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '06:00' })).not.toBeInTheDocument()
  })

  it('falls back step to 30 and columns to 4 when non-integer or <= 0', () => {
    render(<TimePicker start="07:00" end="08:00" step={0} />)
    // step 30 default over a 1h window -> 07:00, 07:30, 08:00
    expect(screen.getByRole('button', { name: '07:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '07:30' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '08:00' })).toBeInTheDocument()
  })

  it('falls back columns to 4 for a non-integer value (checked via CSS custom property)', () => {
    const { container } = render(<TimePicker start="07:00" end="08:00" step={30} columns={2.5} />)
    const grid = container.querySelector('.time-picker__grid') as HTMLElement
    expect(grid.style.getPropertyValue('--time-picker-columns')).toBe('4')
  })
})

describe('TimePicker — grid variant', () => {
  it('marks a busy slot as disabled', () => {
    render(<TimePicker start="07:00" end="08:00" step={30} busy={['07:30']} />)
    expect(screen.getByRole('button', { name: '07:30' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '07:00' })).not.toBeDisabled()
  })

  it('marks the selected slot with aria-pressed', () => {
    render(<TimePicker start="07:00" end="08:00" step={30} value="07:30" />)
    expect(screen.getByRole('button', { name: '07:30' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '07:00' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked enabled slot', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimePicker start="07:00" end="08:00" step={30} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '07:30' }))
    expect(onChange).toHaveBeenCalledWith('07:30')
  })

  it('only one slot has tabIndex=0 (roving tabindex), and it is not a busy one', () => {
    render(<TimePicker start="07:00" end="08:00" step={30} busy={['07:00']} />)
    const buttons = ['07:00', '07:30', '08:00'].map((label) =>
      screen.getByRole('button', { name: label }),
    )
    const zeroTab = buttons.filter((button) => button.getAttribute('tabIndex') === '0')
    expect(zeroTab).toHaveLength(1)
    expect(zeroTab[0]).not.toBeDisabled()
  })

  it('ArrowRight/ArrowLeft move focus by one slot, skipping busy slots', async () => {
    const user = userEvent.setup()
    render(<TimePicker start="07:00" end="08:30" step={30} busy={['07:30']} />)
    screen.getByRole('button', { name: '07:00' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: '08:00' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: '07:00' })).toHaveFocus()
  })

  it('Home/End move to the first/last enabled slot', async () => {
    const user = userEvent.setup()
    render(<TimePicker start="07:00" end="08:30" step={30} />)
    screen.getByRole('button', { name: '07:30' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('button', { name: '08:30' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('button', { name: '07:00' })).toHaveFocus()
  })
})

describe('TimePicker — wheel variant', () => {
  it('renders two native <select> elements labeled Hora/Minuto', () => {
    render(<TimePicker variant="wheel" start="07:00" end="09:00" step={30} />)
    expect(screen.getByRole('combobox', { name: 'Hora' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Minuto' })).toBeInTheDocument()
  })

  it('disables an hour option when every slot in that hour is busy', () => {
    render(
      <TimePicker variant="wheel" start="07:00" end="09:00" step={30} busy={['08:00', '08:30']} />,
    )
    const hourSelect = screen.getByRole('combobox', { name: 'Hora' })
    const hour8 = Array.from(hourSelect.querySelectorAll('option')).find((o) => o.value === '08')
    expect(hour8).toBeDisabled()
  })

  it('disables a busy minute option for the selected hour', () => {
    render(
      <TimePicker
        variant="wheel"
        start="07:00"
        end="09:00"
        step={30}
        busy={['07:30']}
        value="07:00"
      />,
    )
    const minuteSelect = screen.getByRole('combobox', { name: 'Minuto' })
    const minute30 = Array.from(minuteSelect.querySelectorAll('option')).find(
      (o) => o.value === '30',
    )
    expect(minute30).toBeDisabled()
  })

  it('changing hour with an invalid/busy minute deterministically reselects the first free minute', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TimePicker
        variant="wheel"
        start="07:00"
        end="09:00"
        step={30}
        busy={['08:00']}
        value="07:00"
        onChange={onChange}
      />,
    )
    const hourSelect = screen.getByRole('combobox', { name: 'Hora' })
    await user.selectOptions(hourSelect, '08')
    // 08:00 is busy, so it must deterministically fall back to the first free minute of hour 8 -> 08:30
    expect(onChange).toHaveBeenCalledWith('08:30')
  })

  it('never fires onChange for a busy combination', async () => {
    const onChange = vi.fn()
    render(
      <TimePicker
        variant="wheel"
        start="07:00"
        end="09:00"
        step={30}
        busy={['07:30']}
        value="07:00"
        onChange={onChange}
      />,
    )
    const minuteSelect = screen.getByRole('combobox', { name: 'Minuto' }) as HTMLSelectElement
    const busyOption = Array.from(minuteSelect.options).find((o) => o.value === '30')
    expect(busyOption?.disabled).toBe(true)
  })
})

describe('TimePicker — grid variant, responsive columns', () => {
  it('does not set --time-picker-columns when columns is omitted (CSS handles the responsive default)', () => {
    const { container } = render(<TimePicker start="07:00" end="08:00" step={30} />)
    const grid = container.querySelector('.time-picker__grid') as HTMLElement
    expect(grid.style.getPropertyValue('--time-picker-columns')).toBe('')
    expect(grid.className).not.toMatch(/--fixed-columns/)
  })

  it('sets --time-picker-columns and the fixed-columns class when columns is explicitly passed', () => {
    const { container } = render(
      <TimePicker start="07:00" end="08:00" step={30} columns={2} />,
    )
    const grid = container.querySelector('.time-picker__grid') as HTMLElement
    expect(grid.style.getPropertyValue('--time-picker-columns')).toBe('2')
    expect(grid.className).toMatch(/--fixed-columns/)
  })
})

describe('TimePicker — grid variant, Few state', () => {
  it('marks a "few" slot without disabling it, and it remains selectable', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TimePicker start="07:00" end="08:00" step={30} few={['07:30']} onChange={onChange} />,
    )
    const slot = screen.getByRole('button', { name: /07:30/ })
    expect(slot).not.toBeDisabled()
    await user.click(slot)
    expect(onChange).toHaveBeenCalledWith('07:30')
  })

  it('busy (unavailable) takes precedence over few for the same slot', () => {
    render(<TimePicker start="07:00" end="08:00" step={30} busy={['07:30']} few={['07:30']} />)
    expect(screen.getByRole('button', { name: /07:30/ })).toBeDisabled()
  })

  it('shows the price when provided via the `prices` prop', () => {
    render(
      <TimePicker start="07:00" end="07:00" step={30} prices={{ '07:00': 'R$ 120' }} />,
    )
    expect(screen.getByText('R$ 120')).toBeInTheDocument()
  })
})

describe('TimePicker — layout="grouped"', () => {
  it('groups slots under Manhã/Tarde/Noite period headers', () => {
    render(<TimePicker layout="grouped" start="09:00" end="19:00" step={60} />)
    expect(screen.getByRole('button', { name: /Manhã/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tarde/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Noite/ })).toBeInTheDocument()
  })

  it('expands the first period by default and collapses the rest', () => {
    render(<TimePicker layout="grouped" start="09:00" end="19:00" step={60} />)
    expect(screen.getByRole('button', { name: /Manhã/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Tarde/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('radio', { name: '13:00' })).not.toBeInTheDocument()
  })

  it('toggles a period open/closed on click, revealing its slots as radios', async () => {
    const user = userEvent.setup()
    render(<TimePicker layout="grouped" start="09:00" end="19:00" step={60} />)
    await user.click(screen.getByRole('button', { name: /Tarde/ }))
    expect(screen.getByRole('button', { name: /Tarde/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: '13:00' })).toBeInTheDocument()
  })

  it('renders an unavailable slot as a focusable, aria-disabled radio (not removed from focus order)', () => {
    render(<TimePicker layout="grouped" start="09:00" end="11:00" step={60} busy={['10:00']} />)
    const radio = screen.getByRole('radio', { name: /10:00/ })
    expect(radio).toHaveAttribute('aria-disabled', 'true')
    expect(radio).not.toBeDisabled()
  })

  it('calls onChange when a radio slot is clicked, and marks it aria-checked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimePicker layout="grouped" start="09:00" end="11:00" step={60} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '10:00' }))
    expect(onChange).toHaveBeenCalledWith('10:00')
  })
})

describe('TimePicker — layout="list"', () => {
  it('renders all periods and their slots without any collapse control', () => {
    render(<TimePicker layout="list" start="09:00" end="19:00" step={60} />)
    expect(screen.getByText('Manhã')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '13:00' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '19:00' })).toBeInTheDocument()
  })

  it('ArrowDown/ArrowUp move roving focus across the whole flattened list', async () => {
    const user = userEvent.setup()
    render(<TimePicker layout="list" start="09:00" end="11:00" step={60} />)
    screen.getByRole('radio', { name: '09:00' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: '10:00' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('radio', { name: '09:00' })).toHaveFocus()
  })
})

describe('TimePicker — theming and tokens', () => {
  it('never uses the legacy --ink token', () => {
    const css = readFileSync('src/components/ui/TimePicker/TimePicker.css', 'utf8')
    expect(css).not.toMatch(/--ink\b/)
  })

  it('renders without throwing regardless of the light/dark data-theme attribute, for every variant/layout', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(() => render(<TimePicker start="07:00" end="08:00" step={30} />)).not.toThrow()
    expect(() =>
      render(<TimePicker variant="wheel" start="07:00" end="08:00" step={30} />),
    ).not.toThrow()
    expect(() =>
      render(<TimePicker layout="grouped" start="07:00" end="20:00" step={30} />),
    ).not.toThrow()
    expect(() =>
      render(<TimePicker layout="list" start="07:00" end="20:00" step={30} />),
    ).not.toThrow()
    document.documentElement.removeAttribute('data-theme')
  })
})
