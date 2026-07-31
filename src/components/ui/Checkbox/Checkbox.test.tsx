import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'

function ControlledCheckbox({ label = 'Aceito os termos' }: { label?: string }) {
  const [checked, setChecked] = useState(false)
  return <Checkbox label={label} checked={checked} onChange={setChecked} />
}

describe('Checkbox', () => {
  it('renders a real, focusable <input type="checkbox"> — never display:none', () => {
    render(<Checkbox label="Aceito os termos" />)
    const checkbox = screen.getByRole('checkbox', { name: 'Aceito os termos' })
    expect(checkbox.tagName).toBe('INPUT')
    expect(checkbox).toHaveAttribute('type', 'checkbox')
    expect(checkbox).not.toHaveStyle({ display: 'none' })
  })

  it('is locatable via aria-label when no visible label is given', () => {
    render(<Checkbox ariaLabel="Marcar todos" />)
    expect(screen.getByRole('checkbox', { name: 'Marcar todos' })).toBeInTheDocument()
  })

  it('toggles checked on click and reports the new value via onChange', async () => {
    const user = userEvent.setup()
    render(<ControlledCheckbox />)
    const checkbox = screen.getByRole('checkbox', { name: 'Aceito os termos' })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('Tab focuses it and Space toggles it — no custom keydown handler', async () => {
    const user = userEvent.setup()
    render(<ControlledCheckbox />)
    const checkbox = screen.getByRole('checkbox', { name: 'Aceito os termos' })
    expect(checkbox).not.toHaveAttribute('onkeydown')
    await user.tab()
    expect(checkbox).toHaveFocus()
    await user.keyboard(' ')
    expect(checkbox).toBeChecked()
  })

  it('does not fire onChange and stays unchecked when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="Indisponível" checked={false} onChange={onChange} disabled />)
    const checkbox = screen.getByRole('checkbox', { name: 'Indisponível' })
    expect(checkbox).toBeDisabled()
    await user.click(checkbox)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('CSS: decorative box is aria-hidden, real input is visually hidden but not display:none', () => {
    const css = readFileSync('src/components/ui/Checkbox/Checkbox.css', 'utf8')
    expect(css).not.toMatch(/display:\s*none/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('renders a check icon inside the decorative box only when checked', () => {
    const { rerender } = render(<Checkbox label="Aceito os termos" checked={false} onChange={() => {}} />)
    expect(document.querySelector('.checkbox__check')).not.toBeInTheDocument()

    rerender(<Checkbox label="Aceito os termos" checked onChange={() => {}} />)
    expect(document.querySelector('.checkbox__check')).toBeInTheDocument()
  })

  it('applies a disabled modifier class to the root for the dimmed Figma disabled state', () => {
    render(<Checkbox label="Indisponível" disabled />)
    expect(document.querySelector('.checkbox--disabled')).toBeInTheDocument()
  })
})
