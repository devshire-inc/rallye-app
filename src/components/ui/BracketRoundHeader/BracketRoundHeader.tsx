import type { ElementType } from 'react'
import './BracketRoundHeader.css'

/** `pill` é o símbolo do Figma (node 265:1433). `plain` é o cabeçalho de
 * rodada como as telas de chave o desenham: Overline em `text/muted`, sem
 * caixa, sem largura própria. */
export type BracketRoundHeaderVariant = 'pill' | 'plain'

export interface BracketRoundHeaderProps {
  /** Nome da rodada como texto livre (ex. "Oitavas", "Semifinal", "Ronda 1") — não é um enum fixo, torneios variam. */
  round: string
  matchCount?: number
  /** Ativa o tratamento destacado (surface/brand-soft + text/brand-strong) da rodada do campeonato. Só na variante `pill`. */
  isFinal?: boolean
  /** id do heading, para ligar via aria-labelledby ao <ol> de confrontos da rodada. */
  id?: string
  /** Nível semântico do heading — ajuste conforme a hierarquia da página que compõe a chave. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  variant?: BracketRoundHeaderVariant
  /** Só na variante `pill`: solta os 240px do símbolo e ocupa a largura da coluna que o contém. */
  fluid?: boolean
}

/**
 * Cabeçalho de rodada da chave.
 *
 * ## Duas variantes
 *
 * - `pill` (padrão, Figma node 265:1433): pílula em `surface/sunken` com a
 *   contagem de jogos e destaque de Final. Nasceu com `width: 240px` fixa,
 *   calibrada para a coluna do protótipo; `fluid` solta essa largura para
 *   quem compõe a chave em colunas de outra medida — foi um dos motivos de o
 *   componente não ter encaixado em nenhuma tela.
 * - `plain`: só o heading, Overline em `text/muted`. É o que os frames de
 *   Torneios · Chave desenham (nenhuma caixa, nenhuma contagem) e o que
 *   `BracketPage` consome.
 *
 * Em `plain` a contagem, quando informada, entra como sufixo do próprio
 * heading (" · 8 jogos") em vez de virar uma segunda caixa — a variante não
 * tem onde pendurar um segundo bloco.
 */
export function BracketRoundHeader({
  round,
  matchCount,
  isFinal = false,
  id,
  headingLevel = 3,
  variant = 'pill',
  fluid = false,
}: BracketRoundHeaderProps) {
  const HeadingTag = `h${headingLevel}` as ElementType
  const countLabel = matchCount !== undefined ? `${matchCount} ${matchCount === 1 ? 'jogo' : 'jogos'}` : null

  if (variant === 'plain') {
    return (
      <HeadingTag id={id} className="bracket-round-header__name bracket-round-header__name--plain">
        {round}
        {countLabel ? <span className="bracket-round-header__count"> · {countLabel}</span> : null}
      </HeadingTag>
    )
  }

  return (
    <div
      className={`bracket-round-header${isFinal ? ' bracket-round-header--final' : ''}${
        fluid ? ' bracket-round-header--fluid' : ''
      }`}
    >
      <HeadingTag id={id} className="bracket-round-header__name">
        {round}
      </HeadingTag>
      {countLabel ? <span className="bracket-round-header__count">{countLabel}</span> : null}
    </div>
  )
}
