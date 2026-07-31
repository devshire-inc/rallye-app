import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarGroup } from './AvatarGroup'
import './Avatar.stories.css'

const MEMBERS = [
  { name: 'Ana Silva' },
  { name: 'Bruno Fernandes' },
  { name: 'Carlos Souza' },
  { name: 'Duda Lima' },
  { name: 'Eduarda Melo' },
  { name: 'Felipe Rocha' },
]

const meta = {
  title: 'ui/Avatar/AvatarGroup',
  component: AvatarGroup,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    max: { control: 'number' },
  },
  args: {
    size: 'sm',
    members: MEMBERS.slice(0, 3),
    max: 4,
  },
} satisfies Meta<typeof AvatarGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Overflow: Story = {
  args: { members: MEMBERS },
}

/** Size x Overflow — espelha o frame "Avatar Group" (node 258:2025) do Figma. */
export const SizeOverflowMatrix: Story = {
  render: () => {
    const sizes = ['sm', 'md', 'lg'] as const
    return (
      <div className="avatar-story-rows">
        {sizes.map((size) => (
          <div key={size} className="avatar-story-row">
            <span className="avatar-story-row__label">{size}</span>
            <AvatarGroup size={size} members={MEMBERS.slice(0, 3)} />
            <AvatarGroup size={size} members={MEMBERS} />
          </div>
        ))}
      </div>
    )
  },
}
