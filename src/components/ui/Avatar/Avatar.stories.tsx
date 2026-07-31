import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from './Avatar'
import { AvatarIndicator } from './AvatarIndicator'
import { AvatarBadge } from './AvatarBadge'
import './Avatar.stories.css'

const meta = {
  title: 'ui/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    name: { control: 'text' },
    src: { control: 'text' },
  },
  args: {
    size: 'md',
    name: 'Bruno Fernandes',
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade completa dos 5 tamanhos — espelha o frame "Avatar" (node 24:27) do Figma. */
export const SizeScale: Story = {
  render: (args) => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const
    return (
      <div className="avatar-story-row">
        {sizes.map((size) => (
          <Avatar key={size} {...args} size={size} />
        ))}
      </div>
    )
  },
}

/** HasPhoto x HasFallbackIcon: foto, iniciais na cor do esporte, ou a
 * silhueta genérica quando não há nome nem foto (usuário sem nome não tem
 * identidade de esporte). */
export const PhotoInitialsFallback: Story = {
  render: () => (
    <div className="avatar-story-row">
      <Avatar name="Ana Silva" src="https://i.pravatar.cc/160?img=5" size="lg" />
      <Avatar name="Carlos Souza" size="lg" />
      <Avatar size="lg" />
    </div>
  ),
}

/** Indicator (canto inferior direito) e Badge (canto superior direito) —
 * cantos opostos, podem coexistir a partir de Medium (ver node 24:3,
 * "QUANDO NÃO USAR" para a ressalva em XSmall/Small). */
export const WithIndicatorAndBadge: Story = {
  render: () => (
    <div className="avatar-story-row">
      <Avatar name="Ana Silva" size="lg" indicator={<AvatarIndicator status="online" />} />
      <Avatar name="Carlos Souza" size="lg" badge={<AvatarBadge type="professor" label="Professor" />} />
      <Avatar
        name="Duda Lima"
        size="lg"
        indicator={<AvatarIndicator status="confirmed" />}
        badge={<AvatarBadge type="ouro" label="Medalha Ouro" />}
      />
    </div>
  ),
}
