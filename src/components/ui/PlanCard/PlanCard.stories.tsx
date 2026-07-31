import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlanCard } from './PlanCard'

const meta = {
  title: 'ui/PlanCard',
  component: PlanCard,
  tags: ['autodocs'],
  argTypes: {
    planLabel: { control: 'text' },
    badgeLabel: { control: 'text' },
    badgeTone: {
      control: 'select',
      options: ['success', 'warning', 'danger', 'info', 'brand', 'neutral'],
    },
    price: { control: 'text' },
    pricePeriod: { control: 'text' },
    description: { control: 'text' },
    onClick: { control: 'boolean' },
  },
  args: {
    planLabel: 'Mensal · 2x/semana',
    badgeLabel: 'Confirmada',
    badgeTone: 'success',
    price: 'R$ 240',
    pricePeriod: '/mês',
    description: '2 aulas por semana + acesso à quadra livre nos fins de semana.',
  },
} satisfies Meta<typeof PlanCard>

export default meta
type Story = StoryObj<typeof meta>

/** `onClick` no Storybook aceita `true`/`false` via control; quando `true`
 * o card renderiza como `<button>` (Figma node 102:22). */
export const Playground: Story = {
  render: (args) => <PlanCard {...args} onClick={args.onClick ? () => {} : undefined} />,
}

export const WithoutBadge: Story = {
  args: { badgeLabel: undefined },
}
