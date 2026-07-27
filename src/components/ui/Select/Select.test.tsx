import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  it('is locatable via getByLabelText when label is given, and htmlFor/id match', () => {
    render(<Select label="Esporte" options={['Padel', 'Vôlei']} />)
    const select = screen.getByLabelText('Esporte')
    const label = screen.getByText('Esporte')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', select.id)
  })

  it('is locatable via getByLabelText when only ariaLabel is given (no visible label)', () => {
    render(<Select ariaLabel="Filtrar por esporte" options={['Padel']} />)
    expect(screen.getByLabelText('Filtrar por esporte')).toBeInTheDocument()
    expect(screen.queryByText('Filtrar por esporte')?.tagName).not.toBe('LABEL')
  })

  it('renders string options as both value and label', () => {
    render(<Select label="Esporte" options={['Padel', 'Vôlei']} />)
    expect(screen.getByRole('option', { name: 'Padel' })).toHaveValue('Padel')
  })

  it('renders {value,label} options', () => {
    render(
      <Select
        label="Esporte"
        options={[
          { value: 'padel', label: 'Padel' },
          { value: 'volei', label: 'Vôlei' },
        ]}
      />,
    )
    expect(screen.getByRole('option', { name: 'Padel' })).toHaveValue('padel')
  })

  it('renders a disabled placeholder option when given', () => {
    render(<Select label="Esporte" placeholder="Selecione" options={['Padel']} />)
    const placeholder = screen.getByRole('option', { name: 'Selecione' })
    expect(placeholder).toBeDisabled()
  })

  it('forwards native attributes and disabled, and fires onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Select label="Esporte" options={['Padel', 'Vôlei']} onChange={onChange} />)
    const select = screen.getByLabelText('Esporte')
    await user.selectOptions(select, 'Vôlei')
    expect(onChange).toHaveBeenCalled()
  })

  it('honors an explicit id', () => {
    render(<Select label="Esporte" id="custom-id" options={['Padel']} />)
    expect(screen.getByLabelText('Esporte')).toHaveAttribute('id', 'custom-id')
  })

  it('forwards disabled', () => {
    render(<Select label="Esporte" options={['Padel']} disabled />)
    expect(screen.getByLabelText('Esporte')).toBeDisabled()
  })

  it('CSS: height, radius, border, font per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Select/Select.css', 'utf8')
    expect(css).toMatch(/height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-md\)/)
    expect(css).toMatch(/border:\s*1px solid var\(--border-default\)/)
    expect(css).toMatch(/font:\s*var\(--type-body\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
