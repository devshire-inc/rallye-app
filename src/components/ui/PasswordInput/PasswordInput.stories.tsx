import type { Meta, StoryObj } from '@storybook/react-vite'
import { PasswordInput } from './PasswordInput'

const meta = {
  title: 'ui/PasswordInput',
  component: PasswordInput,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    helper: { control: 'text' },
    error: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    label: 'Senha',
    helper: 'Mínimo 8 caracteres',
    error: '',
    size: 'md',
    disabled: false,
    placeholder: 'Digite sua senha',
  },
} satisfies Meta<typeof PasswordInput>

export default meta
type Story = StoryObj<typeof meta>

/** Click the eye icon — it's a real, working toggle (type=password <-> text). */
export const Playground: Story = {}

export const WithError: Story = {
  args: { error: 'Senha muito curta', helper: '' },
}

export const Disabled: Story = {
  args: { disabled: true },
}

/** Grade Size x State, cada campo com o toggle real e clicável. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: 280 }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <PasswordInput
          key={size}
          label={`Senha (${size})`}
          helper="Mínimo 8 caracteres"
          size={size}
          placeholder="Digite sua senha"
        />
      ))}
    </div>
  ),
}
