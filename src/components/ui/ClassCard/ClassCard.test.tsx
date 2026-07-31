import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClassCard } from './ClassCard'

describe('ClassCard', () => {
  it('imports the real SportTag/Avatar/Badge components — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/ClassCard/ClassCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Avatar\/Avatar['"]/)
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it('renders a real Avatar (initials) for the coach', () => {
    render(<ClassCard sport="padel" coach="Ana Silva" />)
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('combines coach and court into a single meta line', () => {
    render(<ClassCard sport="padel" coach="Ana Silva" court="Quadra 2" />)
    expect(screen.getByText('Ana Silva · Quadra 2')).toBeInTheDocument()
  })

  it.each([
    ['confirmada', 'Confirmada'],
    ['pendente', 'Pendente'],
    ['cancelada', 'Cancelada'],
  ] as const)('maps status=%s to the correct Badge tone/label', (status, label) => {
    render(<ClassCard sport="padel" status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders title, time and court when given', () => {
    render(<ClassCard sport="padel" title="Aula de Padel" time="19:00" court="Quadra 2" />)
    expect(screen.getByText('Aula de Padel')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(screen.getByText('Quadra 2')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<ClassCard sport="padel" title="Aula" />)
    expect(container.querySelector('div.class-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ClassCard sport="padel" title="Aula" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Aula/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders without throwing for an unknown sport slug', () => {
    expect(() => render(<ClassCard sport="krav-maga" title="Aula" />)).not.toThrow()
  })
})
