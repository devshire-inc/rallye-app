import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Segmented, type SegmentedProps } from './Segmented'
import './Segmented.stories.css'

/** No-op tipado: só preenche o arg obrigatório do meta — as stories
 * assumem o controle do handler. */
const noop: SegmentedProps['onChange'] = () => {}

const meta = {
  title: 'ui/Segmented',
  component: Segmented,
  tags: ['autodocs'],
  argTypes: {
    options: { control: 'object' },
    value: { control: 'text' },
    ariaLabel: { control: 'text' },
  },
  args: {
    options: ['Hoje', 'Semana', 'Mês'],
    value: 'Hoje',
    ariaLabel: 'Período',
    onChange: noop,
  },
} satisfies Meta<typeof Segmented>

export default meta
type Story = StoryObj<typeof meta>

/** args.value only seeds the initial selection — a real control must own its
 * state so clicking a segment in the Storybook canvas actually switches it.
 * Clicking between segments also demonstrates the sliding indicator: the
 * active pill's background is a single shared element that animates its
 * position/width to the clicked button rather than each button toggling
 * its own background instantly. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return (
      <Segmented
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next)
          args.onChange?.(next)
        }}
      />
    )
  },
}

/** Estados de um segmento isolado (Default/Hover/Focus/Selected) — espelha o
 * frame "Segment" (node 84:10) do Figma. Hover/Focus são pseudo-classes
 * reais do botão, então são simuladas aqui com classes de estado sintéticas
 * só para fins de documentação estática. */
export const States: Story = {
  render: () => (
    <div className="segmented-story-row">
      <Segmented options={['Default']} ariaLabel="Default" />
      <div className="segmented-story--hover">
        <Segmented options={['Hover']} ariaLabel="Hover" />
      </div>
      <div className="segmented-story--focus">
        <Segmented options={['Focus']} ariaLabel="Focus" />
      </div>
      <Segmented options={['Selected']} value="Selected" ariaLabel="Selected" />
    </div>
  ),
}
