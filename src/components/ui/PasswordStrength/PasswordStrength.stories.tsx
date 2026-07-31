import type { Meta, StoryObj } from '@storybook/react-vite'
import { PasswordStrength } from './PasswordStrength'

const meta = {
  title: 'ui/PasswordStrength',
  component: PasswordStrength,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Presentational strength meter — computing the level from an actual password (entropy/rules) is the caller\'s job, this component only renders a given level.',
      },
    },
  },
  argTypes: {
    level: { control: 'select', options: ['none', 'weak', 'medium', 'strong'] },
    caption: { control: 'text' },
  },
  args: {
    level: 'none',
    caption: 'Força da senha',
  },
} satisfies Meta<typeof PasswordStrength>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <PasswordStrength {...args} />
    </div>
  ),
}

export const AllLevels: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: 280 }}>
      <PasswordStrength level="none" />
      <PasswordStrength level="weak" />
      <PasswordStrength level="medium" />
      <PasswordStrength level="strong" />
    </div>
  ),
}
