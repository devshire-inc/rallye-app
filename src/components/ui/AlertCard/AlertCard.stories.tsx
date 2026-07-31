import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertCard } from './AlertCard'

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

/** As 4 variantes de tom (fundo + borda tonais, texto sempre text/heading). */
export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <AlertCard tone="warning">Responsável (aluno menor de idade)</AlertCard>
      <AlertCard tone="danger">Pagamento em atraso há 5 dias.</AlertCard>
      <AlertCard tone="info">Nova política de cancelamento a partir de 01/09.</AlertCard>
      <AlertCard tone="success">Plano renovado com sucesso.</AlertCard>
    </div>
  ),
}
