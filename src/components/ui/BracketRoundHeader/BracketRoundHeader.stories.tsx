import type { Meta, StoryObj } from '@storybook/react-vite'
import { BracketRoundHeader } from './BracketRoundHeader'
import './BracketRoundHeader.stories.css'

const meta = {
  title: 'ui/BracketRoundHeader',
  component: BracketRoundHeader,
  tags: ['autodocs'],
  argTypes: {
    round: { control: 'text' },
    matchCount: { control: 'number' },
    isFinal: { control: 'boolean' },
    headingLevel: { control: 'select', options: [2, 3, 4, 5, 6] },
  },
  args: {
    round: 'Oitavas',
    matchCount: 8,
    isFinal: false,
  },
} satisfies Meta<typeof BracketRoundHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade das 4 rodadas do exemplo do Figma (node 265:1433) — round é texto
 * livre, então qualquer rótulo funciona (não é um enum fixo). Final usa
 * `isFinal` para o tratamento destacado (surface/brand-soft). */
export const Rounds: Story = {
  render: () => (
    <div className="bracket-round-header-story-row">
      <BracketRoundHeader round="Oitavas" matchCount={8} />
      <BracketRoundHeader round="Quartas" matchCount={4} />
      <BracketRoundHeader round="Semi" matchCount={2} />
      <BracketRoundHeader round="Final" matchCount={1} isFinal />
    </div>
  ),
}
