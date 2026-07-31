import './MatchCard.css'

export type MatchCardState = 'scheduled' | 'live' | 'finished' | 'wo'
export type MatchCardFormat = 'dupla' | 'individual'

export interface MatchCardParticipant {
  /** Seed/posição do participante dentro do confronto (ex.: "1", "8") — distinto do seed da chave no header. */
  seed?: string | number
  /** String única em Individual; array de 2 nomes (a dupla) em Dupla. */
  name: string | string[]
  /** Placar por set, até 3 células. Ignorado quando `state="wo"`. */
  sets?: (number | string)[]
  /** Só produz marcação visual (barra + check) quando `state` é `"finished"` ou `"wo"`. */
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

function isPluralParticipant(participant: MatchCardParticipant): boolean {
  return Array.isArray(participant.name) && participant.name.length > 1
}

function buildSetsSummary(a: MatchCardParticipant, b: MatchCardParticipant): string {
  if (!a.sets || !b.sets || a.sets.length === 0) return ''
  return a.sets.map((score, i) => `${score}-${b.sets?.[i] ?? ''}`).join(', ')
}

function buildAriaLabel({ state, participants, scheduledLabel }: MatchCardProps): string {
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
  const verb = winner ? (isPluralParticipant(winner) ? 'venceram' : 'venceu') : 'venceram'

  if (state === 'wo') {
    return `${winnerName} ${verb} por W.O.`
  }

  const setsSummary = buildSetsSummary(a, b)
  return setsSummary ? `${winnerName} ${verb} por ${setsSummary}` : `${winnerName} ${verb}`
}

export function MatchCard(props: MatchCardProps) {
  const { state, format, seed, category, scheduledLabel, participants } = props
  const [a, b] = participants
  const isWO = state === 'wo'
  const showWinnerMarks = state === 'finished' || state === 'wo'
  const statusText = state === 'scheduled' ? scheduledLabel : STATUS_LABEL[state]
  const ariaLabel = buildAriaLabel(props)

  function renderParticipant(participant: MatchCardParticipant) {
    const isWinner = showWinnerMarks && !!participant.winner
    return (
      <div className="match-card__participant">
        <div className="match-card__identity">
          {isWinner ? <span className="match-card__winner-bar" aria-hidden="true" /> : null}
          {participant.seed !== undefined ? (
            <span className="match-card__participant-seed">{participant.seed}</span>
          ) : null}
          <span className="match-card__name">{displayName(participant, isWO)}</span>
        </div>
        <div className="match-card__result">
          {isWinner ? (
            <span className="match-card__check" aria-hidden="true">
              ✓
            </span>
          ) : null}
          {!isWO && participant.sets && participant.sets.length > 0 ? (
            <div className="match-card__sets">
              {participant.sets.slice(0, 3).map((score, i) => (
                <span className="match-card__score" key={i}>
                  {score}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`match-card match-card--${format}`}
      role="group"
      aria-label={ariaLabel}
      aria-live={state === 'live' ? 'polite' : undefined}
    >
      <div className="match-card__header">
        {seed ? <span className="match-card__seed">{seed}</span> : null}
        {category ? <span className="match-card__category">{category}</span> : null}
        {statusText ? <span className={`match-card__status ${STATUS_CLASS[state]}`}>{statusText}</span> : null}
      </div>
      {renderParticipant(a)}
      <span className="match-card__divider" aria-hidden="true" />
      {renderParticipant(b)}
    </div>
  )
}
