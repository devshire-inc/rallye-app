import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card } from './Card'
import './Card.stories.css'

const meta = {
  title: 'ui/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/** Card estático (`<div>`) — sem elevação de hover, pois não é acionável. */
export const Static: Story = {
  render: () => (
    <div className="card-story-wrap">
      <Card>Card content</Card>
    </div>
  ),
}

/**
 * Card interativo (`<button>`) — eleva de Shadow/Card para Shadow/Raised no
 * hover (node Figma 25:10, "State=Hover"). O Storybook Docs não simula
 * `:hover`; passe o mouse sobre o card renderizado no canvas para ver a
 * elevação real.
 */
export const Interactive: Story = {
  render: () => (
    <div className="card-story-wrap">
      <Card interactive onClick={() => {}}>
        Card content
      </Card>
    </div>
  ),
}

/** Conteúdo maior demonstrando o comportamento do padding customizável. */
export const WithMoreContent: Story = {
  render: () => (
    <div className="card-story-wrap">
      <Card padding="var(--space-6)">
        <strong>Reserva confirmada</strong>
        <br />
        Quadra 3 · Beach Tennis · 30/07 às 19h. Chegue com 10 minutos de antecedência para o
        check-in.
      </Card>
    </div>
  ),
}
