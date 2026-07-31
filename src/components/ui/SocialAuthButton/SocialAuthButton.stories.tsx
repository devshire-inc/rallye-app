import type { Meta, StoryObj } from '@storybook/react-vite'
import { SocialAuthButton } from './SocialAuthButton'

const meta = {
  title: 'ui/SocialAuthButton',
  component: SocialAuthButton,
  tags: ['autodocs'],
  argTypes: {
    style: { control: 'select', options: ['outline', 'dark', 'light'] },
    logo: { control: 'select', options: [undefined, 'google', 'apple', 'whatsapp'] },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    style: 'outline',
    label: 'Continuar com Google',
    logo: 'google',
    disabled: false,
  },
} satisfies Meta<typeof SocialAuthButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <div style={{ width: 330 }}>
      <SocialAuthButton {...args} />
    </div>
  ),
}

export const Google: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 330 }}>
      <SocialAuthButton style="outline" logo="google" label="Continuar com Google" />
      <SocialAuthButton style="dark" logo="google" label="Continuar com Google" />
    </div>
  ),
}

/** Apple exige fundo preto, branco, ou branco com borda — Style=Dark e Style=Light existem por isso. */
export const Apple: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 330 }}>
      <SocialAuthButton style="dark" logo="apple" label="Continuar com Apple" />
      <SocialAuthButton style="light" logo="apple" label="Continuar com Apple" />
    </div>
  ),
}

export const NoLogoPlaceholder: Story = {
  args: { logo: undefined, label: 'Continuar com Google' },
  render: (args) => (
    <div style={{ width: 330 }}>
      <SocialAuthButton {...args} />
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div style={{ width: 330 }}>
      <SocialAuthButton {...args} />
    </div>
  ),
}
