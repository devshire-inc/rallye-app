import type { Meta, StoryObj } from '@storybook/react-vite'
import { SPORTS } from '../../../lib/sports'
import { ClassCard } from './ClassCard'
import './ClassCard.stories.css'

const meta = {
  title: 'ui/ClassCard',
  component: ClassCard,
  tags: ['autodocs'],
  argTypes: {
    sport: {
      control: 'select',
      options: SPORTS.map((sport) => sport.slug),
    },
    title: { control: 'text' },
    time: { control: 'text' },
    court: { control: 'text' },
    coach: { control: 'text' },
    status: {
      control: 'select',
      options: ['confirmada', 'pendente', 'cancelada'],
    },
    onClick: { control: 'boolean' },
  },
  args: {
    sport: 'beach_tennis',
    title: 'Aula de Beach Tennis',
    time: '18:00',
    court: 'Quadra 1',
    coach: 'Prof. Rafa',
    status: 'confirmada',
  },
} satisfies Meta<typeof ClassCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `onClick` no Storybook aceita `true`/`false` via control; quando `true`
 * o card renderiza como `<button>` (Figma node 55:50, State=Hover ao
 * passar o mouse — a elevação de Shadow/Card para Shadow/Raised não é
 * simulável estaticamente no Docs, veja no canvas renderizado).
 */
export const Playground: Story = {
  render: (args) => (
    <div className="class-card-story-wrap">
      <ClassCard {...args} onClick={args.onClick ? () => {} : undefined} />
    </div>
  ),
}

/** Grade dos 3 status (node 55:50) — State=Default. Passe o mouse sobre
 * qualquer linha no canvas para ver o State=Hover real (Shadow/Raised),
 * o mesmo caveat do Interactive do Card/CourtCard. */
export const States: Story = {
  render: () => (
    <div className="class-card-story-list">
      {(['confirmada', 'pendente', 'cancelada'] as const).map((status) => (
        <ClassCard
          key={status}
          sport="beach_tennis"
          title="Aula de Beach Tennis"
          time="18:00"
          court="Quadra 1"
          coach="Prof. Rafa"
          status={status}
          onClick={() => {}}
        />
      ))}
    </div>
  ),
}
