import type { Meta, StoryObj } from '@storybook/react-vite'
import { SPORTS } from '../../../lib/sports'
import { EventCard } from './EventCard'
import './EventCard.stories.css'

const meta = {
  title: 'ui/EventCard',
  component: EventCard,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['torneio', 'experimental', 'social', 'bloqueio'],
    },
    title: { control: 'text' },
    date: { control: 'text' },
    location: { control: 'text' },
    sport: {
      control: 'select',
      options: SPORTS.map((sport) => sport.slug),
    },
    status: {
      control: 'select',
      options: ['convite', 'inscrito', 'abertas', 'lotado', 'encerrado'],
    },
    onClick: { control: 'boolean' },
  },
  args: {
    type: 'torneio',
    title: 'Torneio de duplas',
    date: 'Sáb · 09h00',
    location: 'Arena Beira-Mar',
    sport: 'beach_tennis',
    status: 'convite',
  },
} satisfies Meta<typeof EventCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `onClick` no Storybook aceita `true`/`false` via control; quando `true`
 * o card renderiza como `<button>` (Figma node 263:1156, State=Hover ao
 * passar o mouse — a elevação de Shadow/Card para Shadow/Raised não é
 * simulável estaticamente no Docs, veja no canvas renderizado; caveat
 * idêntico ao já documentado em Card/CourtCard/ClassCard). Em
 * type="bloqueio" o card sempre renderiza como `<article>` não
 * interativo, mesmo com onClick ligado — o controle é ignorado.
 */
export const Playground: Story = {
  render: (args) => (
    <div className="event-card-story-wrap">
      <EventCard {...args} onClick={args.onClick ? () => {} : undefined} />
    </div>
  ),
}

/**
 * Grade Type × campos condicionais (node 263:1156) — State=Default.
 * Passe o mouse sobre qualquer card no canvas para ver o State=Hover real
 * (borda uniforme border/strong + Shadow/Raised, exceto Torneio que eleva
 * sem borda), o mesmo caveat do Interactive do Card/CourtCard/ClassCard.
 */
export const Types: Story = {
  render: () => (
    <div className="event-card-story-grid">
      <EventCard
        type="torneio"
        title="Torneio de duplas"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
        sport="beach_tennis"
        status="convite"
        onClick={() => {}}
      />
      <EventCard
        type="experimental"
        title="Aula experimental de padel"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
        sport="padel"
        status="abertas"
        onClick={() => {}}
      />
      <EventCard
        type="social"
        title="Luau de fim de temporada"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
        sport="volei"
        status="inscrito"
        onClick={() => {}}
      />
      <EventCard
        type="bloqueio"
        title="Manutenção — Quadra 3"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
      />
    </div>
  ),
}

/** Todos os 5 status de inscrição (via EventStatusBadge), no card Experimental. */
export const AllStatuses: Story = {
  render: () => (
    <div className="event-card-story-grid">
      {(['convite', 'inscrito', 'abertas', 'lotado', 'encerrado'] as const).map((status) => (
        <EventCard
          key={status}
          type="experimental"
          title="Aula experimental de padel"
          date="Sáb · 09h00"
          location="Arena Beira-Mar"
          sport="padel"
          status={status}
          onClick={() => {}}
        />
      ))}
    </div>
  ),
}

/** Type=Bloqueio: sem esporte, sem status, sem CTA — sempre `<article>`. */
export const Bloqueio: Story = {
  render: () => (
    <div className="event-card-story-wrap">
      <EventCard
        type="bloqueio"
        title="Manutenção — Quadra 3"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
      />
    </div>
  ),
}
