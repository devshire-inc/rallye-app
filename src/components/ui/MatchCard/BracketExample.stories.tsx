import type { Meta, StoryObj } from '@storybook/react-vite'
import { BracketConnector } from '../BracketConnector/BracketConnector'
import { BracketRoundHeader } from '../BracketRoundHeader/BracketRoundHeader'
import { MatchCard, type MatchCardParticipant } from './MatchCard'
import './BracketExample.stories.css'

/**
 * Composição de exemplo espelhando o node 265:1626 ("Chave — exemplo de
 * montagem", Semifinal -> Final) — não existe um componente de chave
 * fechada (node 240:502 do doc: "a chave é composta na tela"), então esta
 * story mostra como MatchCard/BracketConnector/BracketRoundHeader se
 * encaixam: cada rodada é um <ol> de <li><MatchCard/></li> com o
 * BracketRoundHeader como heading, e os conectores (aria-hidden) ficam em
 * colunas próprias entre as rodadas, verticalmente centralizados.
 */
const meta = {
  title: 'ui/MatchCard/Bracket assembled example',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const semi1: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 4, 10], winner: true },
  { seed: 8, name: ['Carla', 'João'], sets: [4, 6, 8] },
]

const semi2: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 4, 10] },
  { seed: 8, name: ['Carla', 'João'], sets: [4, 6, 8], winner: true },
]

const final: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 3] },
  { seed: 8, name: ['Carla', 'João'], sets: [4, 5] },
]

export const SemifinalToFinal: Story = {
  render: () => (
    <div className="bracket-example">
      <div className="bracket-example__header bracket-example__header--semi">
        <BracketRoundHeader round="Semifinal" matchCount={2} id="round-semi" />
      </div>
      <div className="bracket-example__header bracket-example__header--final">
        <BracketRoundHeader round="Final" matchCount={1} isFinal id="round-final" />
      </div>

      <ol className="bracket-example__column bracket-example__column--semi" aria-labelledby="round-semi">
        <li>
          <MatchCard state="finished" format="dupla" seed="#3" category="MISTO B" participants={semi1} />
        </li>
        <li>
          <MatchCard state="finished" format="dupla" seed="#3" category="MISTO B" participants={semi2} />
        </li>
      </ol>

      <div className="bracket-example__connector bracket-example__connector--merge">
        <BracketConnector type="merge" />
      </div>

      <ol className="bracket-example__column bracket-example__column--final" aria-labelledby="round-final">
        <li>
          <MatchCard state="live" format="dupla" seed="#3" category="MISTO B" participants={final} />
        </li>
      </ol>

      <div className="bracket-example__connector bracket-example__connector--up">
        <BracketConnector type="up" />
      </div>
    </div>
  ),
}
