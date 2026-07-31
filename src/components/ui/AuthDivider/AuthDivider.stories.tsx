import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthDivider } from './AuthDivider'

const meta = {
  title: 'ui/AuthDivider',
  component: AuthDivider,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
  },
  args: {
    label: 'ou',
  },
} satisfies Meta<typeof AuthDivider>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const CustomLabel: Story = {
  args: { label: 'ou preencha' },
}
