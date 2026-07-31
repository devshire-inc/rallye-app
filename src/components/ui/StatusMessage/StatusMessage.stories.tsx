import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { StatusMessage } from './StatusMessage'
import './StatusMessage.stories.css'

const meta = {
  title: 'ui/StatusMessage',
  component: StatusMessage,
  tags: ['autodocs'],
  argTypes: {
    style: { control: 'radio', options: ['banner', 'fullscreen'] },
    tone: { control: 'radio', options: ['success', 'warning', 'danger', 'info'] },
    title: { control: 'text' },
    description: { control: 'text' },
    showDescription: { control: 'boolean' },
  },
  args: {
    style: 'banner',
    tone: 'success',
    title: 'Alterações salvas com sucesso!',
    description: 'Descrição opcional da mensagem.',
    showDescription: true,
  },
} satisfies Meta<typeof StatusMessage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * O canvas re-renderiza com as props de verdade — as ações do Fullscreen
 * disparam um `window.alert` visível para confirmar que o callback está
 * conectado, não só o Control.
 */
export const Playground: Story = {
  render: (args) => {
    const [lastAction, setLastAction] = useState<string | null>(null)
    return (
      <div>
        <StatusMessage
          {...args}
          actions={
            args.style === 'fullscreen'
              ? [
                  { label: 'Ver financeiro', onClick: () => setLastAction('Ver financeiro') },
                  { label: 'Lançar outro', variant: 'secondary', onClick: () => setLastAction('Lançar outro') },
                ]
              : undefined
          }
        />
        {args.style === 'fullscreen' && (
          <p className="status-message-story-feedback">
            {lastAction ? `Última ação clicada: ${lastAction}` : 'Nenhuma ação clicada ainda.'}
          </p>
        )}
      </div>
    )
  },
}

/** Grade completa Style=Banner|Fullscreen x Tone=Success|Warning|Danger|Info
 * — espelha o frame de variantes "Status Message" (node 100:25) do Figma. */
export const States: Story = {
  render: () => (
    <div className="status-message-story-grid">
      {(['success', 'warning', 'danger', 'info'] as const).map((tone) => (
        <div className="status-message-story-row" key={tone}>
          <StatusMessage
            style="banner"
            tone={tone}
            title="Alterações salvas com sucesso!"
            description="Descrição opcional da mensagem."
          />
          <StatusMessage
            style="fullscreen"
            tone={tone}
            title="Alterações salvas com sucesso!"
            description="Descrição opcional da mensagem."
            actions={[{ label: 'Ver financeiro' }, { label: 'Lançar outro', variant: 'secondary' }]}
          />
        </div>
      ))}
    </div>
  ),
}
