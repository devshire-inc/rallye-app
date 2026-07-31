import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChargeCard } from './ChargeCard'

const meta = {
  title: 'ui/ChargeCard',
  component: ChargeCard,
  tags: ['autodocs'],
  argTypes: {
    payerName: { control: 'text' },
    description: { control: 'text' },
    amount: { control: 'text' },
    status: {
      control: 'select',
      options: [undefined, 'confirmada', 'pendente', 'atrasada'],
    },
    actionLabel: { control: 'text' },
    onAction: { control: 'boolean' },
  },
  args: {
    payerName: 'Marina Costa',
    description: 'Mensalidade agosto · vence 05/08',
    amount: 'R$ 240',
    status: 'confirmada',
    actionLabel: 'Marcar como pago',
  },
} satisfies Meta<typeof ChargeCard>

export default meta
type Story = StoryObj<typeof meta>

/** `onAction` no Storybook aceita `true`/`false` via control; o botão só
 * renderiza quando `actionLabel` e `onAction` estão presentes juntos. */
export const Playground: Story = {
  render: (args) => (
    <ChargeCard {...args} onAction={args.onAction ? () => {} : undefined} />
  ),
}

/** Grade dos 3 status suportados (Figma node 102:8, mapeamento de Badge). */
export const Statuses: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <ChargeCard
        payerName="Marina Costa"
        description="Mensalidade agosto · vence 05/08"
        amount="R$ 240"
        status="confirmada"
        actionLabel="Marcar como pago"
        onAction={() => {}}
      />
      <ChargeCard
        payerName="João Pereira"
        description="Mensalidade agosto · vence 10/08"
        amount="R$ 240"
        status="pendente"
        actionLabel="Marcar como pago"
        onAction={() => {}}
      />
      <ChargeCard
        payerName="Ana Souza"
        description="Mensalidade julho · venceu 05/07"
        amount="R$ 240"
        status="atrasada"
      />
    </div>
  ),
}
