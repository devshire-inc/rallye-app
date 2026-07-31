import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs } from './Tabs'
import './Tabs.stories.css'

const meta = {
  title: 'ui/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    tabs: { control: 'object' },
    value: { control: 'text' },
    ariaLabel: { control: 'text' },
  },
  args: {
    tabs: ['Quadras', 'Aulas', 'Torneios'],
    value: 'Quadras',
    ariaLabel: 'Abas de navegação',
    onChange: () => {},
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

/** args.value only seeds the initial selection — a real control must own its
 * state so clicking a tab in the Storybook canvas actually switches it.
 * Clicking between tabs also demonstrates the sliding indicator: the active
 * underline is a single shared element that animates its position/width to
 * the clicked tab rather than each tab drawing its own underline instantly. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return (
      <Tabs
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

/** Estados de uma aba isolada (Default/Focus/Active) — espelha o frame "Tab
 * Item" (node 33:35) do Figma. Focus é uma pseudo-classe real do botão,
 * então é simulado aqui com uma classe de estado sintética só para fins de
 * documentação estática. */
export const States: Story = {
  render: () => (
    <div className="tabs-story-row">
      <Tabs tabs={['Default']} ariaLabel="Default" />
      <div className="tabs-story--focus">
        <Tabs tabs={['Focus']} ariaLabel="Focus" />
      </div>
      <Tabs tabs={['Active']} value="Active" ariaLabel="Active" />
    </div>
  ),
}
