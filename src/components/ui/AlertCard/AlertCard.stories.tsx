import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertCard } from './AlertCard'
import './AlertCard.stories.css'

const meta = {
  title: 'ui/AlertCard',
  component: AlertCard,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['warning', 'danger', 'info', 'success'],
    },
    children: { control: 'text' },
    showIcon: { control: 'boolean' },
  },
  args: {
    tone: 'warning',
    children: 'Responsável (aluno menor de idade)',
  },
} satisfies Meta<typeof AlertCard>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => <AlertCard {...args} />,
}

/** As 4 variantes de tom (fundo, borda e texto tonais). */
export const Tones: Story = {
  render: () => (
    <div className="alert-card-stories__stack">
      <AlertCard tone="warning">Responsável (aluno menor de idade)</AlertCard>
      <AlertCard tone="danger">Pagamento em atraso há 5 dias.</AlertCard>
      <AlertCard tone="info">Nova política de cancelamento a partir de 01/09.</AlertCard>
      <AlertCard tone="success">Plano renovado com sucesso.</AlertCard>
    </div>
  ),
}

/** Slot de ícone opcional (Figma node 150:1311, "Status Message") — ícone padrão por tom via `showIcon`. */
export const WithIcon: Story = {
  render: () => (
    <div className="alert-card-stories__stack">
      <AlertCard tone="warning" showIcon>
        Responsável (aluno menor de idade)
      </AlertCard>
      <AlertCard tone="danger" showIcon>
        Pagamento em atraso há 5 dias.
      </AlertCard>
      <AlertCard tone="info" showIcon>
        Nova política de cancelamento a partir de 01/09.
      </AlertCard>
      <AlertCard tone="success" showIcon>
        Plano renovado com sucesso.
      </AlertCard>
    </div>
  ),
}
