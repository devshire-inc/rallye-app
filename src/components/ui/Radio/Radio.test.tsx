import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Radio } from './Radio'

function ControlledRadio({ label = 'Bloquear horário' }: { label?: string }) {
  const [checked, setChecked] = useState(false)
  return <Radio label={label} checked={checked} onChange={setChecked} />
}

function RadioGroupExample() {
  const [value, setValue] = useState<'aberto' | 'bloqueado'>('aberto')
  return (
    <>
      <Radio
        name="politica"
        label="Aberto"
        checked={value === 'aberto'}
        onChange={() => setValue('aberto')}
      />
      <Radio
        name="politica"
        label="Bloqueado"
        checked={value === 'bloqueado'}
        onChange={() => setValue('bloqueado')}
      />
    </>
  )
}

describe('Radio', () => {
  it('renders a real, focusable <input type="radio"> — never display:none', () => {
    render(<Radio label="Bloquear horário" />)
    const radio = screen.getByRole('radio', { name: 'Bloquear horário' })
    expect(radio.tagName).toBe('INPUT')
    expect(radio).toHaveAttribute('type', 'radio')
    expect(radio).not.toHaveStyle({ display: 'none' })
  })

  it('is locatable via aria-label when no visible label is given', () => {
    render(<Radio ariaLabel="Selecionar opção" />)
    expect(screen.getByRole('radio', { name: 'Selecionar opção' })).toBeInTheDocument()
  })

  it('toggles checked on click and reports the new value via onChange', async () => {
    const user = userEvent.setup()
    render(<ControlledRadio />)
    const radio = screen.getByRole('radio', { name: 'Bloquear horário' })
    expect(radio).not.toBeChecked()
    await user.click(radio)
    expect(radio).toBeChecked()
  })

  it('Tab focuses it and Space selects it — no custom keydown handler', async () => {
    const user = userEvent.setup()
    render(<ControlledRadio />)
    const radio = screen.getByRole('radio', { name: 'Bloquear horário' })
    expect(radio).not.toHaveAttribute('onkeydown')
    await user.tab()
    expect(radio).toHaveFocus()
    await user.keyboard(' ')
    expect(radio).toBeChecked()
  })

  it('does not fire onChange and stays unchecked when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Radio label="Indisponível" checked={false} onChange={onChange} disabled />)
    const radio = screen.getByRole('radio', { name: 'Indisponível' })
    expect(radio).toBeDisabled()
    await user.click(radio)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('CSS: decorative box is aria-hidden, real input is visually hidden but not display:none', () => {
    const css = readFileSync('src/components/ui/Radio/Radio.css', 'utf8')
    expect(css).not.toMatch(/display:\s*none/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('renders a dot inside the decorative box only when checked', () => {
    const { rerender } = render(<Radio label="Bloquear horário" checked={false} onChange={() => {}} />)
    expect(document.querySelector('.radio__dot')).not.toBeInTheDocument()

    rerender(<Radio label="Bloquear horário" checked onChange={() => {}} />)
    expect(document.querySelector('.radio__dot')).toBeInTheDocument()
  })

  it('applies a disabled modifier class to the root for the dimmed Figma disabled state', () => {
    render(<Radio label="Indisponível" disabled />)
    expect(document.querySelector('.radio--disabled')).toBeInTheDocument()
  })

  it('groups radios by name so selecting one deselects the others (native radio-group behavior)', async () => {
    const user = userEvent.setup()
    render(<RadioGroupExample />)
    const aberto = screen.getByRole('radio', { name: 'Aberto' })
    const bloqueado = screen.getByRole('radio', { name: 'Bloqueado' })
    expect(aberto).toBeChecked()
    expect(bloqueado).not.toBeChecked()

    await user.click(bloqueado)
    expect(bloqueado).toBeChecked()
    expect(aberto).not.toBeChecked()
  })
})
