import type { ElementType } from 'react'
import './BracketRoundHeader.css'

export interface BracketRoundHeaderProps {
  /** Nome da rodada como texto livre (ex. "Oitavas", "Semifinal", "Ronda 1") — não é um enum fixo, torneios variam. */
  round: string
  matchCount?: number
  /** Ativa o tratamento destacado (surface/brand-soft + text/brand-strong) da rodada do campeonato. */
  isFinal?: boolean
  /** id do heading, para ligar via aria-labelledby ao <ol> de confrontos da rodada. */
  id?: string
  /** Nível semântico do heading — ajuste conforme a hierarquia da página que compõe a chave. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
}

export function BracketRoundHeader({ round, matchCount, isFinal = false, id, headingLevel = 3 }: BracketRoundHeaderProps) {
  const HeadingTag = `h${headingLevel}` as ElementType

  return (
    <div className={`bracket-round-header${isFinal ? ' bracket-round-header--final' : ''}`}>
      <HeadingTag id={id} className="bracket-round-header__name">
        {round}
      </HeadingTag>
      {matchCount !== undefined ? (
        <span className="bracket-round-header__count">
          {matchCount} {matchCount === 1 ? 'jogo' : 'jogos'}
        </span>
      ) : null}
    </div>
  )
}
