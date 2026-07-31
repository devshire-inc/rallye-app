import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarIndicator } from './AvatarIndicator'
import { Avatar } from './Avatar'
import './Avatar.stories.css'

const meta = {
  title: 'ui/Avatar/AvatarIndicator',
  component: AvatarIndicator,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['online', 'offline', 'confirmed', 'pending'],
    },
  },
  args: {
    status: 'online',
  },
} satisfies Meta<typeof AvatarIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Os 4 status — espelha o frame "Avatar Indicator" (node 258:557) do Figma.
 * Online e Confirmed usam a mesma cor; só Confirmed ganha o check. */
export const AllStatuses: Story = {
  render: () => {
    const statuses = ['online', 'offline', 'confirmed', 'pending'] as const
    return (
      <div className="avatar-story-row">
        {statuses.map((status) => (
          <Avatar key={status} name="Ana Silva" size="lg" indicator={<AvatarIndicator status={status} />} />
        ))}
      </div>
    )
  },
}
