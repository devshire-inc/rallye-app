import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarBadge, type AvatarBadgeType } from './AvatarBadge'
import { Avatar } from './Avatar'
import './Avatar.stories.css'

const LABELS: Record<AvatarBadgeType, string> = {
  professor: 'Professor',
  admin: 'Administrador',
  bronze: 'Medalha Bronze',
  prata: 'Medalha Prata',
  ouro: 'Medalha Ouro',
  platina: 'Medalha Platina',
  diamante: 'Medalha Diamante',
}

const meta = {
  title: 'ui/Avatar/AvatarBadge',
  component: AvatarBadge,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['professor', 'admin', 'bronze', 'prata', 'ouro', 'platina', 'diamante'],
    },
    label: { control: 'text' },
  },
  args: {
    type: 'professor',
    label: 'Professor',
  },
} satisfies Meta<typeof AvatarBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** PAPEL (ícone) x TIER (letra) — espelha o frame "Avatar Badge" (node
 * 258:742). A distinção é de forma, não só de cor. */
export const AllTypes: Story = {
  render: () => {
    const types = Object.keys(LABELS) as AvatarBadgeType[]
    return (
      <div className="avatar-story-row">
        {types.map((type) => (
          <Avatar key={type} name="Ana Silva" size="lg" badge={<AvatarBadge type={type} label={LABELS[type]} />} />
        ))}
      </div>
    )
  },
}
