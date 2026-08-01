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
    variant: { control: 'radio', options: ['pill', 'plain'] },
    fluid: { control: 'boolean' },
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

/** Variante `plain`: o cabeçalho de rodada como as telas de Chave o desenham
 * — Overline em text/muted, sem caixa e sem largura própria. É o que
 * `BracketPage` consome. */
export const Plain: StoryObj = {
  render: () => (
    <div className="bracket-round-header-story-stack">
      <BracketRoundHeader round="Quartas" variant="plain" headingLevel={2} />
      <BracketRoundHeader round="Semifinal" variant="plain" headingLevel={2} />
      <BracketRoundHeader round="Final" variant="plain" headingLevel={2} matchCount={1} />
    </div>
  ),
}

/** `fluid` solta os 240px fixos do símbolo para a pílula acompanhar a largura
 * da coluna em que a chave é composta. */
export const Fluid: StoryObj = {
  render: () => (
    <div className="bracket-round-header-story-column">
      <BracketRoundHeader round="Semifinal" matchCount={2} fluid />
      <BracketRoundHeader round="Final" matchCount={1} isFinal fluid />
    </div>
  ),
}
