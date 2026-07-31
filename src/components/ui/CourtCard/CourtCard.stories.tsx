import type { Meta, StoryObj } from '@storybook/react-vite'
import { SPORTS } from '../../../lib/sports'
import { CourtCard } from './CourtCard'
import './CourtCard.stories.css'

const meta = {
  title: 'ui/CourtCard',
  component: CourtCard,
  tags: ['autodocs'],
  argTypes: {
    sport: {
      control: 'select',
      options: SPORTS.map((sport) => sport.slug),
    },
    name: { control: 'text' },
    status: { control: 'text' },
    price: { control: 'text' },
    onClick: { control: 'boolean' },
  },
  args: {
    sport: 'beach_tennis',
    name: 'Quadra 1',
    status: undefined,
    price: 'R$ 120/h',
  },
} satisfies Meta<typeof CourtCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `onClick` no Storybook aceita `true`/`false` via control; quando `true`
 * o card renderiza como `<button>` (Figma node 34:2, State=Hover ao passar
 * o mouse — a elevação de Shadow/Card para Shadow/Raised não é simulável
 * estaticamente no Docs, veja no canvas renderizado).
 */
export const Playground: Story = {
  render: (args) => (
    <div className="court-card-story-wrap">
      <CourtCard {...args} onClick={args.onClick ? () => {} : undefined} />
    </div>
  ),
}

/** Grade completa dos 6 esportes (node 52:79) — State=Default. Passe o
 * mouse sobre qualquer card no canvas para ver o State=Hover real
 * (borda de 2px em --interactive-primary-hover + Shadow/Raised), o mesmo
 * caveat do Interactive do Card. */
export const States: Story = {
  render: () => (
    <div className="court-card-story-grid">
      {SPORTS.map((sport, index) => (
        <CourtCard
          key={sport.slug}
          sport={sport.slug}
          name={`Quadra ${index + 1}`}
          price="R$ 120/h"
          onClick={() => {}}
        />
      ))}
    </div>
  ),
}
