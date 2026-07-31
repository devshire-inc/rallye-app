import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatCard } from './StatCard'
import './StatCard.stories.css'

const meta = {
  title: 'ui/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    delta: { control: 'text' },
    deltaTone: {
      control: 'select',
      options: [undefined, 'success', 'danger'],
    },
  },
  args: {
    label: 'Reservas hoje',
    value: '32',
    delta: '+12%',
    deltaTone: 'success',
  },
} satisfies Meta<typeof StatCard>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** DeltaTone=success/danger — espelha a grade de variantes "StatCard" (node 42:31) do Figma. */
export const States: Story = {
  render: () => (
    <div className="stat-card-story-row">
      <StatCard label="Reservas hoje" value="32" delta="+12%" deltaTone="success" />
      <StatCard label="Reservas hoje" value="32" delta="-8%" deltaTone="danger" />
    </div>
  ),
}

/** label e value são obrigatórios na prática, mas delta/deltaTone são opcionais na API. */
export const NoDelta: Story = {
  args: {
    delta: undefined,
    deltaTone: undefined,
  },
}
