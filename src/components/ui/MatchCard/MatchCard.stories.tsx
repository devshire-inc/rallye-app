import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchCard, type MatchCardParticipant } from './MatchCard'
import './MatchCard.stories.css'

const dupla: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 4, 10] },
  { seed: 8, name: ['Carla', 'João'], sets: [4, 6, 8] },
]

const meta = {
  title: 'ui/MatchCard',
  component: MatchCard,
  tags: ['autodocs'],
  argTypes: {
    state: { control: 'radio', options: ['scheduled', 'live', 'finished', 'wo'] },
    format: { control: 'radio', options: ['dupla', 'individual'] },
    seed: { control: 'text' },
    category: { control: 'text' },
    scheduledLabel: { control: 'text' },
    statusLabel: { control: 'text' },
    statusPlacement: { control: 'radio', options: ['header', 'footer'] },
    density: { control: 'radio', options: ['default', 'compact'] },
    winnerStyle: { control: 'radio', options: ['marks', 'emphasis'] },
    fluid: { control: 'boolean' },
    divider: { control: 'boolean' },
  },
  args: {
    state: 'finished',
    format: 'dupla',
    seed: '#3',
    category: 'MISTO B',
    participants: [
      { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 4, 10], winner: true },
      { seed: 8, name: ['Carla', 'João'], sets: [4, 6, 8] },
    ],
  },
} satisfies Meta<typeof MatchCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `participants` não tem control dedicado (é uma tupla estruturada) — ajuste
 * `state`/`format`/`seed`/`category`/`scheduledLabel` no painel e edite os
 * args da story para trocar nomes/placares.
 */
export const Playground: Story = {}

/** Grade State x Format (Figma node 205:42) — replica os 8 símbolos do
 * frame "Match Card". `scheduledLabel` só aparece no lugar do status
 * quando `state="scheduled"`. */
export const StatesAndFormats: Story = {
  render: () => (
    <div className="match-card-story-grid">
      {(['scheduled', 'live', 'finished', 'wo'] as const).map((state) => (
        <div className="match-card-story-row" key={state}>
          <MatchCard
            state={state}
            format="dupla"
            seed="#3"
            category="MISTO B"
            scheduledLabel="Sáb, 14:00"
            participants={
              state === 'live'
                ? [
                    { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 3] },
                    { seed: 8, name: ['Carla', 'João'], sets: [4, 5] },
                  ]
                : dupla.map((p, i) => ({ ...p, winner: i === 0 })) as [MatchCardParticipant, MatchCardParticipant]
            }
          />
          <MatchCard
            state={state}
            format="individual"
            seed="#3"
            category="MISTO B"
            scheduledLabel="Sáb, 14:00"
            participants={
              state === 'live'
                ? [
                    { seed: 1, name: 'Bruno Fernandes', sets: [6, 3] },
                    { seed: 8, name: 'Carla Souza', sets: [4, 5] },
                  ]
                : ([
                    { seed: 1, name: 'Bruno Fernandes', sets: [6, 4, 10], winner: true },
                    { seed: 8, name: 'Carla Souza', sets: [4, 6, 8] },
                  ] as [MatchCardParticipant, MatchCardParticipant])
            }
          />
        </div>
      ))}
    </div>
  ),
}

/** W.O.: nomes ganham o sufixo "(W.O.)" e o placar some — só o vencedor
 * carrega a barra + check. */
export const WalkoverHidesScores: Story = {
  args: {
    state: 'wo',
    format: 'dupla',
    participants: [
      { seed: 1, name: ['Bruno', 'Marina'], winner: true },
      { seed: 8, name: ['Carla', 'João'] },
    ],
  },
}

/**
 * Variantes de composição das telas de chave (BracketPage): `fluid` +
 * `density="compact"` + `statusPlacement="footer"` + `statusLabel` +
 * `divider={false}` + `winnerStyle="emphasis"` + `onClick`.
 *
 * Cada card é um `<button>` cujo nome acessível é a frase montada pelo
 * componente — inspecione com o addon de acessibilidade. O contorno de estado
 * (ao vivo em `state/danger`, agendado em `border/strong`) e os glifos
 * ✓/🔴/⏳ do status vêm da densidade `compact`.
 */
export const BracketScreenVariant: Story = {
  render: () => (
    <div className="match-card-story-column">
      <MatchCard
        state="finished"
        format="dupla"
        fluid
        density="compact"
        divider={false}
        winnerStyle="emphasis"
        statusPlacement="footer"
        statusLabel="Finalizado"
        onClick={() => {}}
        participants={[
          { name: 'Marina / Carla', sets: [6], winner: true },
          { name: 'Duda / Bia', sets: [4] },
        ]}
      />
      <MatchCard
        state="live"
        format="dupla"
        fluid
        density="compact"
        divider={false}
        winnerStyle="emphasis"
        statusPlacement="footer"
        statusLabel="Ao vivo · Quadra #7"
        onClick={() => {}}
        participants={[
          { name: 'Ana / Rita', sets: [3] },
          { name: 'Sofia / Lu', sets: [5], winner: true },
        ]}
      />
      <MatchCard
        state="scheduled"
        format="dupla"
        fluid
        density="compact"
        divider={false}
        winnerStyle="emphasis"
        statusPlacement="footer"
        statusLabel="14:00 · Quadra #2"
        scheduledLabel="14:00 · Quadra #2"
        onClick={() => {}}
        participants={[
          { name: 'A definir', sets: ['—'] },
          { name: 'A definir', sets: ['—'] },
        ]}
      />
    </div>
  ),
}

/**
 * O mesmo card em modo interativo mantendo o desenho do símbolo — `onClick`
 * é independente das variantes de densidade.
 */
export const Interactive: Story = {
  args: { onClick: () => {} },
}
