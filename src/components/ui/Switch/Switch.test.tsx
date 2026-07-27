import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

function ControlledSwitch({ label = 'Notificações' }: { label?: string }) {
  const [checked, setChecked] = useState(false)
  return <Switch label={label} checked={checked} onChange={setChecked} />
}

describe('Switch', () => {
  it('renders <button role="switch" aria-checked>', () => {
    render(<Switch label="Notificações" checked={false} />)
    const control = screen.getByRole('switch', { name: 'Notificações' })
    expect(control.tagName).toBe('BUTTON')
    expect(control).toHaveAttribute('type', 'button')
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects checked=true via aria-checked', () => {
    render(<Switch label="Notificações" checked />)
    expect(screen.getByRole('switch', { name: 'Notificações' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('has an accessible name from ariaLabel when no visible label is given', () => {
    render(<Switch ariaLabel="Modo escuro" checked={false} />)
    expect(screen.getByRole('switch', { name: 'Modo escuro' })).toBeInTheDocument()
  })

  it('toggles on click and reports the new value via onChange', async () => {
    const user = userEvent.setup()
    render(<ControlledSwitch />)
    const control = screen.getByRole('switch', { name: 'Notificações' })
    expect(control).toHaveAttribute('aria-checked', 'false')
    await user.click(control)
    expect(control).toHaveAttribute('aria-checked', 'true')
  })

  it('Tab focuses it and Enter/Space activate it — no custom keydown handler', async () => {
    const user = userEvent.setup()
    render(<ControlledSwitch />)
    const control = screen.getByRole('switch', { name: 'Notificações' })
    expect(control).not.toHaveAttribute('onkeydown')

    await user.tab()
    expect(control).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(control).toHaveAttribute('aria-checked', 'true')
    await user.keyboard(' ')
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch label="Indisponível" checked={false} onChange={onChange} disabled />)
    const control = screen.getByRole('switch', { name: 'Indisponível' })
    expect(control).toBeDisabled()
    await user.click(control)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('CSS: track/thumb structure, no hex literals', () => {
    const css = readFileSync('src/components/ui/Switch/Switch.css', 'utf8')
    expect(css).toMatch(/switch-track/)
    expect(css).toMatch(/switch-thumb/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
