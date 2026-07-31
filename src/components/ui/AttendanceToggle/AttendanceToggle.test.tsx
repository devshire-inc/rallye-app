import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AttendanceGroup, AttendanceToggle, type AttendanceKind } from './AttendanceToggle'

function ControlledGroup({ initial = null as AttendanceKind | null }) {
  const [value, setValue] = useState<AttendanceKind | null>(initial)
  return <AttendanceGroup ariaLabel="Presença de João" value={value} onChange={setValue} />
}

describe('AttendanceToggle', () => {
  it.each([
    ['present', 'Presente'],
    ['absent', 'Falta'],
    ['justified', 'Justificada'],
  ] as const)('renders a %s toggle with its default label', (kind, defaultLabel) => {
    render(<AttendanceToggle kind={kind} />)
    expect(screen.getByRole('button', { name: defaultLabel })).toBeInTheDocument()
  })

  it('accepts a custom label overriding the kind default', () => {
    render(<AttendanceToggle kind="present" label="Presente — João" />)
    expect(screen.getByRole('button', { name: 'Presente — João' })).toBeInTheDocument()
  })

  it('reflects selected via aria-pressed', () => {
    render(<AttendanceToggle kind="present" selected />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('defaults to unselected (aria-pressed=false)', () => {
    render(<AttendanceToggle kind="absent" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<AttendanceToggle kind="justified" onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<AttendanceToggle kind="present" onClick={onClick} disabled />)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies the per-kind and selected modifier classes', () => {
    render(<AttendanceToggle kind="absent" selected />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('attendance-toggle--absent')
    expect(button).toHaveClass('attendance-toggle--selected')
  })

  it('CSS: unselected uses the neutral surface, selected fills with the per-kind semantic color, no hex literals', () => {
    const css = readFileSync('src/components/ui/AttendanceToggle/AttendanceToggle.css', 'utf8')
    expect(css).toMatch(/\.attendance-toggle\s*\{[^}]*background:\s*var\(--surface-sunken\)/s)
    expect(css).toMatch(/\.attendance-toggle--present\.attendance-toggle--selected\s*\{[^}]*background:\s*var\(--state-success\)/s)
    expect(css).toMatch(/\.attendance-toggle--absent\.attendance-toggle--selected\s*\{[^}]*background:\s*var\(--state-danger\)/s)
    expect(css).toMatch(/\.attendance-toggle--justified\.attendance-toggle--selected\s*\{[^}]*background:\s*var\(--text-muted\)/s)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('AttendanceGroup', () => {
  it('renders a role="group" with the given ariaLabel, containing one button per kind', () => {
    render(<AttendanceGroup ariaLabel="Presença de João" />)
    const group = screen.getByRole('group', { name: 'Presença de João' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Presente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Justificada' })).toBeInTheDocument()
  })

  it('marks only the button matching value as pressed', () => {
    render(<AttendanceGroup ariaLabel="Presença de João" value="absent" />)
    expect(screen.getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Falta' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Justificada' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders no button pressed when value is null', () => {
    render(<AttendanceGroup ariaLabel="Presença de João" value={null} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('is mutually exclusive: selecting one kind deselects the others (real interaction, not a mocked onChange)', async () => {
    const user = userEvent.setup()
    render(<ControlledGroup />)
    await user.click(screen.getByRole('button', { name: 'Falta' }))
    expect(screen.getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Falta' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Justificada' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Justificada' }))
    expect(screen.getByRole('button', { name: 'Falta' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Justificada' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with the clicked kind', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AttendanceGroup ariaLabel="Presença de João" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Presente' }))
    expect(onChange).toHaveBeenCalledWith('present')
  })

  it('disables every toggle when disabled is set', () => {
    render(<AttendanceGroup ariaLabel="Presença de João" disabled />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })
})
