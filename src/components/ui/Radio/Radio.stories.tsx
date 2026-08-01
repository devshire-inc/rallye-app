import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Radio, type RadioProps } from './Radio'
import './Radio.stories.css'

/** No-op tipado: só preenche o arg obrigatório do meta — as stories
 * assumem o controle do handler. */
const noop: RadioProps['onChange'] = () => {}

const meta = {
  title: 'ui/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    label: 'Bloquear horário',
    checked: false,
    disabled: false,
    onChange: noop,
  },
} satisfies Meta<typeof Radio>

export default meta
type Story = StoryObj<typeof meta>

/** args.checked only seeds the initial value — a real radio must own its
 * selection so clicking it in the Storybook canvas actually selects it. */
export const Playground: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked)
    return (
      <Radio
        {...args}
        checked={checked}
        onChange={(value) => {
          setChecked(value)
          args.onChange?.(value)
        }}
      />
    )
  },
}

/** Grade Selected x State — espelha o frame de variantes "Radio" (node 101:23)
 * do Figma. Hover/Focus são pseudo-classes reais do input, então são simuladas
 * aqui com classes de estado sintéticas só para fins de documentação estática. */
export const States: Story = {
  render: () => (
    <div className="radio-story-rows">
      {[false, true].map((checked) => (
        <div key={String(checked)} className="radio-story-row">
          <Radio label="Default" checked={checked} onChange={() => {}} />
          <div className="radio-story--hover">
            <Radio label="Hover" checked={checked} onChange={() => {}} />
          </div>
          <div className="radio-story--focus">
            <Radio label="Focus" checked={checked} onChange={() => {}} />
          </div>
          <Radio label="Disabled" checked={checked} disabled onChange={() => {}} />
        </div>
      ))}
    </div>
  ),
}

/** Uso real do Radio: grupo de opções mutuamente exclusivas via `name`
 * compartilhado, como na política de bloqueio das Configurações da arena. */
export const RadioGroupExample: Story = {
  render: () => {
    const [value, setValue] = useState<'nenhum' | 'parcial' | 'total'>('nenhum')
    return (
      <div className="radio-story-group">
        <Radio
          name="politica-bloqueio"
          label="Sem bloqueio"
          checked={value === 'nenhum'}
          onChange={() => setValue('nenhum')}
        />
        <Radio
          name="politica-bloqueio"
          label="Bloqueio parcial"
          checked={value === 'parcial'}
          onChange={() => setValue('parcial')}
        />
        <Radio
          name="politica-bloqueio"
          label="Bloqueio total"
          checked={value === 'total'}
          onChange={() => setValue('total')}
        />
      </div>
    )
  },
}
