import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ListRow } from './ListRow'

describe('ListRow', () => {
  it('imports the real Avatar/Badge components — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/ListRow/ListRow.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/Avatar\/Avatar['"]/)
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it('renders a real Avatar (initials) for leading=avatar', () => {
    render(<ListRow leading={{ type: 'avatar', name: 'Ana Silva' }} title="Ana Silva" />)
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('renders a colored strip for leading=strip', () => {
    const { container } = render(
      <ListRow leading={{ type: 'strip', color: 'var(--state-success)' }} title="Aula" />,
    )
    const strip = container.querySelector('.list-row__strip')
    expect(strip).toBeInTheDocument()
    expect(strip).toHaveStyle({ '--list-row-strip-color': 'var(--state-success)' })
  })

  it('renders title and meta text', () => {
    render(
      <ListRow leading={{ type: 'avatar', name: 'Ana Silva' }} title="Aula de Padel" meta="19:00 · Quadra 2" />,
    )
    expect(screen.getByText('Aula de Padel')).toBeInTheDocument()
    expect(screen.getByText('19:00 · Quadra 2')).toBeInTheDocument()
  })

  it('omits the meta line when not given', () => {
    const { container } = render(<ListRow leading={{ type: 'avatar' }} title="Aula" />)
    expect(container.querySelector('.list-row__meta')).not.toBeInTheDocument()
  })

  it('renders a real Badge for trailing=badge', () => {
    render(
      <ListRow
        leading={{ type: 'avatar' }}
        title="Aula"
        trailing={{ type: 'badge', tone: 'success', children: 'Confirmada' }}
      />,
    )
    const badge = screen.getByText('Confirmada')
    expect(badge.className).toContain('badge--success')
  })

  it('renders a chevron for trailing=chevron', () => {
    const { container } = render(
      <ListRow leading={{ type: 'avatar' }} title="Aula" trailing={{ type: 'chevron' }} />,
    )
    expect(container.querySelector('.list-row__chevron')).toBeInTheDocument()
  })

  it('renders neither badge nor chevron for trailing=none (the default)', () => {
    const { container } = render(<ListRow leading={{ type: 'avatar' }} title="Aula" />)
    expect(container.querySelector('.list-row__trailing')).not.toBeInTheDocument()
    expect(container.querySelector('.list-row__chevron')).not.toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<ListRow leading={{ type: 'avatar' }} title="Aula" />)
    expect(container.querySelector('div.list-row')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ListRow leading={{ type: 'avatar' }} title="Aula" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Aula/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
