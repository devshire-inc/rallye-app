import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ListRow, type ListRowProps } from './ListRow'
import './ListRow.stories.css'

const meta = {
  title: 'ui/ListRow',
  component: ListRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Linha genérica de lista — Figma node 96:2. Leading: Avatar ou tarja colorida. Trailing: Badge, Chevron ou nada. Sem sombra (diferente de ClassCard/CourtCard); quando interativa, o fundo escurece levemente no hover.',
      },
    },
  },
  argTypes: {
    leading: { control: 'object' },
    title: { control: 'text' },
    meta: { control: 'text' },
    trailing: { control: 'object' },
    onClick: { control: 'boolean' },
  },
  args: {
    leading: { type: 'avatar', name: 'Ana Silva' },
    title: 'Aula de Padel',
    meta: '19:00 · Quadra 2',
    trailing: { type: 'badge', tone: 'success', children: 'Confirmada' },
  },
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

function PlaygroundInner(args: ListRowProps) {
  const [clicks, setClicks] = useState(0)
  return (
    <div className="list-row-story-wrap">
      <ListRow {...args} onClick={args.onClick ? () => setClicks((n) => n + 1) : undefined} />
      {args.onClick ? <p className="list-row-story-note">Clicado: {clicks}x</p> : null}
    </div>
  )
}

/** `onClick` no Storybook aceita `true`/`false` via control; quando `true` a
 * linha renderiza como `<button>` e o contador abaixo prova que o clique é
 * real (a linha não tem estado visual próprio para apontar, ao contrário de
 * Checkbox/Switch). */
export const Playground: Story = {
  render: (args) => <PlaygroundInner {...args} />,
}

/** Grade completa das 6 variantes Leading × Trailing (Figma node 96:50). */
export const AllVariants: Story = {
  render: () => (
    <div className="list-row-story-grid">
      <ListRow
        leading={{ type: 'avatar', name: 'Ana Silva' }}
        title="Título"
        meta="Meta · informação"
        trailing={{ type: 'badge', children: 'Confirmada' }}
      />
      <ListRow
        leading={{ type: 'avatar', name: 'Ana Silva' }}
        title="Título"
        meta="Meta · informação"
        trailing={{ type: 'chevron' }}
        onClick={() => {}}
      />
      <ListRow leading={{ type: 'avatar', name: 'Ana Silva' }} title="Título" meta="Meta · informação" />
      <ListRow
        leading={{ type: 'strip', color: 'var(--state-success)' }}
        title="Título"
        meta="Meta · informação"
        trailing={{ type: 'badge', children: 'Confirmada' }}
      />
      <ListRow
        leading={{ type: 'strip', color: 'var(--state-success)' }}
        title="Título"
        meta="Meta · informação"
        trailing={{ type: 'chevron' }}
        onClick={() => {}}
      />
      <ListRow leading={{ type: 'strip', color: 'var(--state-success)' }} title="Título" meta="Meta · informação" />
    </div>
  ),
}
