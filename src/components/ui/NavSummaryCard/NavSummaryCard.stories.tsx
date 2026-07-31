import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavSummaryCard } from './NavSummaryCard'

const meta = {
  title: 'ui/NavSummaryCard',
  component: NavSummaryCard,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    countLabel: { control: 'text' },
    onClick: { control: 'boolean' },
  },
  args: {
    title: 'Cobranças',
    countLabel: '6 lançamentos',
  },
} satisfies Meta<typeof NavSummaryCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `onClick` no Storybook aceita `true`/`false` via control; quando `true` o
 * card renderiza como `<button>` (Figma node 102:31).
 */
export const Playground: Story = {
  render: (args) => (
    <NavSummaryCard {...args} onClick={args.onClick ? () => {} : undefined} />
  ),
}

export const Static: Story = {
  args: { title: 'Turmas', countLabel: '3 ativas' },
}

export const Clickable: Story = {
  render: () => <NavSummaryCard title="Cobranças" countLabel="6 lançamentos" onClick={() => {}} />,
}
