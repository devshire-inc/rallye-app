import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Icon } from '../Icon/Icon'
import { EmptyState } from './EmptyState'
import './EmptyState.stories.css'

const meta = {
  title: 'ui/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    actionLabel: { control: 'text' },
    icon: { control: false },
    onAction: { control: false },
  },
  args: {
    title: 'Nenhuma reserva encontrada',
    description: 'Quando você fizer uma reserva, ela vai aparecer aqui.',
    actionLabel: 'Fazer reserva',
    icon: <Icon name="calendar" size={40} />,
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

/**
 * O clique no CTA atualiza um texto visível no canvas para confirmar que o
 * callback `onAction` está realmente conectado, não só o Control.
 */
export const Playground: Story = {
  render: (args) => {
    const [lastAction, setLastAction] = useState<string | null>(null)
    return (
      <div>
        <EmptyState {...args} onAction={args.actionLabel ? () => setLastAction(args.actionLabel!) : undefined} />
        <p className="empty-state-story-feedback">
          {lastAction ? `Última ação clicada: ${lastAction}` : 'Nenhuma ação clicada ainda.'}
        </p>
      </div>
    )
  },
}

/** HasAction=false x HasAction=true — espelha o frame de variantes "Empty State" (node 194:5) do Figma. */
export const States: Story = {
  render: () => (
    <div className="empty-state-story-row">
      <EmptyState
        icon={<Icon name="calendar" size={40} />}
        title="Nenhuma reserva encontrada"
        description="Quando você fizer uma reserva, ela vai aparecer aqui."
      />
      <EmptyState
        icon={<Icon name="calendar" size={40} />}
        title="Nenhuma reserva encontrada"
        description="Quando você fizer uma reserva, ela vai aparecer aqui."
        actionLabel="Fazer reserva"
        onAction={() => {}}
      />
    </div>
  ),
}
