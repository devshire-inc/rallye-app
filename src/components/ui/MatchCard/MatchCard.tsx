import './MatchCard.css'

export type MatchCardState = 'scheduled' | 'live' | 'finished' | 'wo'
export type MatchCardFormat = 'dupla' | 'individual'
/** `default` = o símbolo do Figma. `compact` = o card das telas de chave:
 * mesma anatomia, respiro e tipografia menores. */
export type MatchCardDensity = 'default' | 'compact'
/** Onde o status aparece: na faixa de cima junto de seed/categoria (Figma) ou
 * numa linha própria abaixo dos participantes (frames de chave). */
export type MatchCardStatusPlacement = 'header' | 'footer'
/** `marks` = barra + ✓ do Figma. `emphasis` = só peso/cor no nome. */
export type MatchCardWinnerStyle = 'marks' | 'emphasis'

export interface MatchCardParticipant {
  /** Seed/posição do participante dentro do confronto (ex.: "1", "8") — distinto do seed da chave no header. */
  seed?: string | number
  /** String única em Individual; array de 2 nomes (a dupla) em Dupla. */
  name: string | string[]
  /** Placar por set, até 3 células. Ignorado quando `state="wo"`. Células não
   * numéricas (ex. o travessão de um jogo sem placar) são desenhadas mas
   * ficam fora do resumo do `aria-label`. */
  sets?: (number | string)[]
  /** Marcação visual de vencedor — ver `winnerStyle`. */
  winner?: boolean
}

export interface MatchCardProps {
  state: MatchCardState
  format: MatchCardFormat
  /** Seed do confronto na chave, ex. "#3". */
  seed?: string
  /** Categoria/nível, ex. "MISTO B". */
  category?: string
  /** Texto livre de data/horário, exibido só quando `state="scheduled"` (ex. "Sáb, 14:00"). */
  scheduledLabel?: string
  participants: [MatchCardParticipant, MatchCardParticipant]
  /** Sobrescreve o rótulo de status derivado do `state` ("AO VIVO"/"ENCERRADA"
   * /"W.O."). Só afeta o texto visível — o `aria-label` continua sendo a frase
   * montada a partir do estado e do placar. */
  statusLabel?: string
  statusPlacement?: MatchCardStatusPlacement
  density?: MatchCardDensity
  /** Solta os 240px do símbolo e ocupa a largura de quem contém o card. */
  fluid?: boolean
  /** Linha divisória entre os dois participantes (o "vs divider" do Figma). */
  divider?: boolean
  winnerStyle?: MatchCardWinnerStyle
  /** Torna o card inteiro clicável: vira um `<button>` e o `aria-label` de
   * frase montada passa a ser o nome acessível DELE (ver o comentário de
   * pacote abaixo). */
  onClick?: () => void
  className?: string
  'data-testid'?: string
}

const STATUS_LABEL: Record<Exclude<MatchCardState, 'scheduled'>, string> = {
  live: 'AO VIVO',
  finished: 'ENCERRADA',
  wo: 'W.O.',
}

const STATUS_CLASS: Record<MatchCardState, string> = {
  scheduled: 'match-card__status--muted',
  live: 'match-card__status--live',
  finished: 'match-card__status--finished',
  wo: 'match-card__status--wo',
}

function displayName(participant: MatchCardParticipant, isWO: boolean): string {
  const base = Array.isArray(participant.name) ? participant.name.join(' & ') : participant.name
  return isWO ? `${base} (W.O.)` : base
}

function sentenceName(participant: MatchCardParticipant): string {
  return Array.isArray(participant.name) ? participant.name.join(' e ') : participant.name
}

/** Concordância verbal do `aria-label`. Uma dupla é plural mesmo quando o
 * backend entrega os dois nomes já colados numa string só ("Marina / Carla"),
 * que é o caso das telas de torneio — por isso o `format` decide junto com a
 * forma do `name`. */
function isPluralParticipant(participant: MatchCardParticipant, format: MatchCardFormat): boolean {
  if (format === 'dupla') return true
  return Array.isArray(participant.name) && participant.name.length > 1
}

function isScore(value: number | string | undefined): boolean {
  if (value === undefined) return false
  const text = `${value}`.trim()
  return text !== '' && !Number.isNaN(Number(text))
}

function buildSetsSummary(a: MatchCardParticipant, b: MatchCardParticipant): string {
  if (!a.sets || !b.sets || a.sets.length === 0) return ''
  return a.sets
    .map((score, i) => ({ score, other: b.sets?.[i] }))
    .filter(({ score, other }) => isScore(score) && isScore(other))
    .map(({ score, other }) => `${score}-${other}`)
    .join(', ')
}

function buildAriaLabel({ state, format, participants, scheduledLabel }: MatchCardProps): string {
  const [a, b] = participants
  const nameA = sentenceName(a)
  const nameB = sentenceName(b)

  if (state === 'scheduled') {
    return scheduledLabel
      ? `${nameA} contra ${nameB}, agendado para ${scheduledLabel}`
      : `${nameA} contra ${nameB}, agendado`
  }

  if (state === 'live') {
    const setsSummary = buildSetsSummary(a, b)
    return setsSummary
      ? `${nameA} contra ${nameB}, ao vivo, ${setsSummary}`
      : `${nameA} contra ${nameB}, ao vivo`
  }

  const winner = a.winner ? a : b.winner ? b : undefined
  const winnerName = winner ? sentenceName(winner) : `${nameA} e ${nameB}`
  const verb = winner ? (isPluralParticipant(winner, format) ? 'venceram' : 'venceu') : 'venceram'

  if (state === 'wo') {
    return `${winnerName} ${verb} por W.O.`
  }

  const setsSummary = buildSetsSummary(a, b)
  return setsSummary ? `${winnerName} ${verb} por ${setsSummary}` : `${winnerName} ${verb}`
}

/**
 * Confronto da chave (Figma node 205:42, variants 205:2..265:1318).
 *
 * ## Acessibilidade — por que `onClick` move o `aria-label`
 *
 * O trabalho mais caro deste componente é o `aria-label` de frase montada
 * ("Bruno e Marina venceram por 6-4, 4-6, 10-8"): sem ele, um leitor de tela
 * anuncia uma sopa de nomes e números soltos. Na forma não interativa a frase
 * fica num `role="group"`.
 *
 * Quando o card inteiro é o alvo de clique — que é como as telas de chave o
 * usam — envolver este `role="group"` num `<button>` externo **perderia** a
 * frase: o nome acessível do botão é calculado a partir do conteúdo, e o
 * `aria-label` de um descendente com role de grupo não entra nele. Por isso
 * `onClick` não adiciona um wrapper: o próprio card vira o `<button>` e leva
 * o `aria-label`, mantendo um único nome acessível — a frase inteira.
 *
 * ## Variantes de composição
 *
 * O símbolo do Figma tem 240px de largura, status na faixa de cima, divisória
 * entre os participantes e vencedor marcado por barra + ✓. As telas de chave
 * desenham a mesma anatomia com outro ajuste, e cada diferença virou uma prop
 * aditiva em vez de um card local: `fluid` (largura elástica), `density`
 * (`compact`), `statusPlacement` (`footer`), `divider={false}`, `winnerStyle`
 * (`emphasis`) e `statusLabel` (status livre, ex. "Ao vivo · Quadra #7").
 * Todos os defaults continuam sendo o símbolo do Figma.
 *
 * A densidade `compact` também deriva o contorno do estado (1,5px em
 * `state/danger` no ao vivo, `border/strong` no agendado) e prefixa o status
 * com o glifo do frame (✓/🔴/⏳) via `::before` — o texto do DOM continua
 * limpo para leitor de tela e para os testes.
 *
 * Ajuste fino por breakpoint sem quebrar encapsulamento: `compact` lê
 * `--match-card-compact-padding`, `--match-card-compact-radius` e
 * `--match-card-text-size` de quem o contém (ver a @media de 1080 em
 * BracketPage.css) — a página não precisa selecionar as classes internas.
 */
export function MatchCard(props: MatchCardProps) {
  const {
    state,
    format,
    seed,
    category,
    scheduledLabel,
    participants,
    statusLabel,
    statusPlacement = 'header',
    density = 'default',
    fluid = false,
    divider = true,
    winnerStyle = 'marks',
    onClick,
    className,
    'data-testid': dataTestId,
  } = props
  const [a, b] = participants
  const isWO = state === 'wo'
  const emphasis = winnerStyle === 'emphasis'
  // Em `marks` a marcação é um resultado (só faz sentido com o jogo decidido);
  // em `emphasis` ela é o realce do lado à frente e acompanha o dado.
  const showWinner = emphasis || state === 'finished' || state === 'wo'
  const statusText = statusLabel ?? (state === 'scheduled' ? scheduledLabel : STATUS_LABEL[state])
  const headerStatus = statusPlacement === 'header' ? statusText : undefined
  const showHeader = Boolean(seed || category || headerStatus)
  const ariaLabel = buildAriaLabel(props)
  const interactive = typeof onClick === 'function'

  function renderParticipant(participant: MatchCardParticipant, key: string) {
    const isWinner = showWinner && !!participant.winner
    return (
      <span className={`match-card__participant${isWinner ? ' match-card__participant--win' : ''}`} key={key}>
        <span className="match-card__identity">
          {isWinner && !emphasis ? <span className="match-card__winner-bar" aria-hidden="true" /> : null}
          {participant.seed !== undefined ? (
            <span className="match-card__participant-seed">{participant.seed}</span>
          ) : null}
          <span className="match-card__name">{displayName(participant, isWO)}</span>
        </span>
        <span className="match-card__result">
          {isWinner && !emphasis ? (
            <span className="match-card__check" aria-hidden="true">
              ✓
            </span>
          ) : null}
          {!isWO && participant.sets && participant.sets.length > 0 ? (
            <span className="match-card__sets">
              {participant.sets.slice(0, 3).map((score, i) => (
                <span className="match-card__score" key={i}>
                  {score}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
    )
  }

  const rootClassName = [
    'match-card',
    `match-card--${format}`,
    `match-card--${state}`,
    density === 'compact' ? 'match-card--compact' : null,
    statusPlacement === 'footer' ? 'match-card--status-footer' : null,
    fluid ? 'match-card--fluid' : null,
    emphasis ? 'match-card--emphasis' : null,
    interactive ? 'match-card--interactive' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      {showHeader ? (
        <span className="match-card__header">
          {seed ? <span className="match-card__seed">{seed}</span> : null}
          {category ? <span className="match-card__category">{category}</span> : null}
          {headerStatus ? (
            <span className={`match-card__status ${STATUS_CLASS[state]}`}>{headerStatus}</span>
          ) : null}
        </span>
      ) : null}
      {renderParticipant(a, 'a')}
      {divider ? <span className="match-card__divider" aria-hidden="true" /> : null}
      {renderParticipant(b, 'b')}
      {statusPlacement === 'footer' && statusText ? (
        <span className={`match-card__status ${STATUS_CLASS[state]}`}>{statusText}</span>
      ) : null}
    </>
  )

  const ariaLive = state === 'live' ? 'polite' : undefined

  if (interactive) {
    return (
      <button
        type="button"
        className={rootClassName}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-live={ariaLive}
        data-testid={dataTestId}
      >
        {body}
      </button>
    )
  }

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      data-testid={dataTestId}
    >
      {body}
    </div>
  )
}
