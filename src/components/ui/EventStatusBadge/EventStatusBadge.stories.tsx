import type { Meta, StoryObj } from '@storybook/react-vite'
import { EventStatusBadge } from './EventStatusBadge'
import './EventStatusBadge.stories.css'

const meta = {
  title: 'ui/EventStatusBadge',
  component: EventStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['convite', 'inscrito', 'abertas', 'lotado', 'encerrado'],
    },
  },
  args: {
    status: 'convite',
  },
} satisfies Meta<typeof EventStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade dos 5 status (Figma node 263:876). */
export const AllStatuses: Story = {
  render: () => {
    const statuses = ['convite', 'inscrito', 'abertas', 'lotado', 'encerrado'] as const
    return (
      <div className="event-status-badge-story-row">
        {statuses.map((status) => (
          <EventStatusBadge key={status} status={status} />
        ))}
      </div>
    )
  },
}
