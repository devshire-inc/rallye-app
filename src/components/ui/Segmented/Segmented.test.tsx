import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from './Segmented'

describe('Segmented', () => {
  it('renders a role="group" with the given ariaLabel', () => {
    render(<Segmented options={['Dia', 'Semana', 'Mês']} value="Dia" ariaLabel="Período" />)
    expect(screen.getByRole('group', { name: 'Período' })).toBeInTheDocument()
  })

  it('renders one aria-pressed button per option, marking the current value', () => {
    render(<Segmented options={['Dia', 'Semana', 'Mês']} value="Semana" ariaLabel="Período" />)
    expect(screen.getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Segmented options={['Dia', 'Semana']} value="Dia" onChange={onChange} ariaLabel="Período" />,
    )
    await user.click(screen.getByRole('button', { name: 'Semana' }))
    expect(onChange).toHaveBeenCalledWith('Semana')
  })

  it('CSS: container and button dimensions/tokens per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Segmented/Segmented.css', 'utf8')
    expect(css).toMatch(/gap:\s*4px/)
    expect(css).toMatch(/padding:\s*4px/)
    expect(css).toMatch(/background:\s*var\(--surface-sunken\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/height:\s*36px/)
    expect(css).toMatch(/padding:\s*0 18px/)
    expect(css).toMatch(/font:\s*var\(--type-label\)/)
    expect(css).toMatch(/background:\s*var\(--surface-card\)/)
    expect(css).toMatch(/color:\s*var\(--text-heading\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
