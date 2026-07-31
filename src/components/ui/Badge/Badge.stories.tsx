import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'
import './Badge.stories.css'

const meta = {
  title: 'ui/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['success', 'warning', 'danger', 'info', 'brand', 'neutral'],
    },
    children: { control: 'text' },
  },
  args: {
    tone: 'success',
    children: 'Confirmada',
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade completa dos 6 tons semânticos — espelha o frame "Badge" (node 23:20) do Figma. */
export const AllTones: Story = {
  render: () => {
    const tones = ['success', 'warning', 'danger', 'info', 'brand', 'neutral'] as const
    return (
      <div className="badge-story-row">
        {tones.map((tone) => (
          <Badge key={tone} tone={tone}>
            Confirmada
          </Badge>
        ))}
      </div>
    )
  },
}
