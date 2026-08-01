import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Switch, type SwitchProps } from './Switch'
import './Switch.stories.css'

/** No-op tipado: só preenche o arg obrigatório do meta — as stories
 * assumem o controle do handler. */
const noop: SwitchProps['onChange'] = () => {}

const meta = {
  title: 'ui/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    label: 'Notificações',
    checked: false,
    disabled: false,
    onChange: noop,
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

/** args.checked only seeds the initial value — a real switch must own its
 * toggle so clicking it in the Storybook canvas actually flips it. */
export const Playground: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked)
    return (
      <Switch
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

/** Grade Checked x State — espelha o frame de variantes "Switch" (node 81:45)
 * do Figma. Hover/Focus são pseudo-classes reais do botão, então são
 * simuladas aqui com classes de estado sintéticas só para fins de
 * documentação estática. */
export const States: Story = {
  render: () => (
    <div className="switch-story-rows">
      {[false, true].map((checked) => (
        <div key={String(checked)} className="switch-story-row">
          <Switch ariaLabel="Default" checked={checked} onChange={() => {}} />
          <div className="switch-story--hover">
            <Switch ariaLabel="Hover" checked={checked} onChange={() => {}} />
          </div>
          <div className="switch-story--focus">
            <Switch ariaLabel="Focus" checked={checked} onChange={() => {}} />
          </div>
          <Switch ariaLabel="Disabled" checked={checked} disabled onChange={() => {}} />
        </div>
      ))}
    </div>
  ),
}
