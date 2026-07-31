import type { Meta, StoryObj } from '@storybook/react-vite'
import { SlotChip } from './SlotChip'
import './SlotChip.stories.css'

const meta = {
  title: 'ui/SlotChip',
  component: SlotChip,
  tags: ['autodocs'],
  argTypes: {
    time: { control: 'text' },
    state: { control: 'radio', options: ['available', 'selected', 'busy'] },
  },
  args: {
    time: '09:00',
    state: 'available',
    onClick: () => {},
  },
} satisfies Meta<typeof SlotChip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ao contrário de Card/CourtCard/ClassCard/ProductCard, o SlotChip não
 * alterna entre `<div>`/`<button>` — o `onClick` do meta já é uma função
 * real, então não há um control `interactive` aqui (sempre renderiza como
 * `<button>` clicável). O Storybook Docs não simula `:hover`; passe o mouse
 * sobre o chip renderizado no canvas para ver o estado real.
 */
export const Playground: Story = {}

/** Grade de estados (Default/Selected/Focus/Busy) — espelha o frame de
 * variantes "SlotChip" (node 42:14) do Figma. Focus é uma pseudo-classe real
 * do botão, então é simulado aqui com uma classe de estado sintética só
 * para fins de documentação estática. */
export const States: Story = {
  render: () => (
    <div className="slot-chip-story-row">
      <SlotChip time="09:00" state="available" />
      <SlotChip time="09:00" state="selected" />
      <div className="slot-chip-story--focus">
        <SlotChip time="09:00" state="available" />
      </div>
      <SlotChip time="09:00" state="busy" />
    </div>
  ),
}
