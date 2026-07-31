import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Chip } from './Chip'
import './Chip.stories.css'

const meta = {
  title: 'ui/Chip',
  component: Chip,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    selected: { control: 'boolean' },
    dot: { control: 'boolean' },
    dotColor: { control: 'color' },
  },
  args: {
    label: 'Filtro',
    selected: false,
    dot: false,
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Chip alterna de forma independente (não é um grupo de escolha única como
 * Segmented/Tabs) — o clique no canvas alterna `selected` de verdade via
 * estado local, refletido de volta nos controls.
 */
export const Playground: Story = {
  render: (args) => {
    const [selected, setSelected] = useState(args.selected ?? false)
    return <Chip {...args} selected={selected} onToggle={setSelected} />
  },
}

/** Grade completa Selected=false|true x HasDot=false|true — espelha o frame
 * de variantes "Chip" (node 98:16) do Figma. */
export const States: Story = {
  render: () => (
    <div className="chip-story-grid">
      <Chip label="Filtro" />
      <Chip label="Filtro" dot />
      <Chip label="Filtro" selected />
      <Chip label="Filtro" selected dot />
    </div>
  ),
}
