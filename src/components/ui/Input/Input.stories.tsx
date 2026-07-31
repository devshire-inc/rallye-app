import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './Input'
import './Input.stories.css'

const meta = {
  title: 'ui/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    helper: { control: 'text' },
    error: { control: 'text' },
    prefix: { control: 'text' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    label: 'Nome completo',
    helper: 'Como aparece na sua reserva',
    error: '',
    prefix: '',
    size: 'md',
    disabled: false,
    placeholder: 'Bruno Fernandes',
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithError: Story = {
  args: { error: 'Nome é obrigatório' },
}

export const WithPrefix: Story = {
  args: { label: 'Preço', prefix: 'R$', placeholder: '0,00', helper: '' },
}

export const Disabled: Story = {
  args: { disabled: true },
}

/** Grade Size x State — espelha o frame de variantes "Input" (node 31:26)
 * do Figma. Focus é simulado com uma classe sintética só para fins de
 * documentação estática, já que :focus-within real não pode ser mantido em
 * vários campos ao mesmo tempo. */
export const States: Story = {
  render: () => {
    const sizes = ['sm', 'md', 'lg'] as const
    const states = ['Default', 'Focus', 'Error', 'Disabled'] as const
    return (
      <div className="input-story-rows">
        {sizes.map((size) => (
          <div key={size} className="input-story-row">
            <span className="input-story-row__label">{size}</span>
            {states.map((state) => (
              <div
                key={state}
                className={`input-story-cell${state === 'Focus' ? ' input-story--focus' : ''}`}
              >
                <Input
                  label="Nome completo"
                  placeholder="Bruno Fernandes"
                  size={size}
                  disabled={state === 'Disabled'}
                  error={state === 'Error' ? 'Nome é obrigatório' : undefined}
                  helper={state === 'Error' ? undefined : 'Como aparece na sua reserva'}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  },
}
