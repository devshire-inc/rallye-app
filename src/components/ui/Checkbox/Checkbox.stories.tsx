import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './Checkbox'
import './Checkbox.stories.css'

const meta = {
  title: 'ui/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    label: 'Confirmar presença',
    checked: false,
    disabled: false,
    onChange: () => {},
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

/** args.checked only seeds the initial value — a real checkbox must own its
 * toggle so clicking it in the Storybook canvas actually flips the box. */
export const Playground: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked)
    return (
      <Checkbox
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

/** Grade Checked x State — espelha o frame de variantes "Checkbox" (node 81:30)
 * do Figma. Hover/Focus são pseudo-classes reais do input, então são simuladas
 * aqui com classes de estado sintéticas só para fins de documentação estática. */
export const States: Story = {
  render: () => (
    <div className="checkbox-story-rows">
      {[false, true].map((checked) => (
        <div key={String(checked)} className="checkbox-story-row">
          <Checkbox label="Default" checked={checked} onChange={() => {}} />
          <div className="checkbox-story--hover">
            <Checkbox label="Hover" checked={checked} onChange={() => {}} />
          </div>
          <div className="checkbox-story--focus">
            <Checkbox label="Focus" checked={checked} onChange={() => {}} />
          </div>
          <Checkbox label="Disabled" checked={checked} disabled onChange={() => {}} />
        </div>
      ))}
    </div>
  ),
}
