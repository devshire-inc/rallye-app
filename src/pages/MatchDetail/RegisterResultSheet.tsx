import { useState } from 'react'
import {
  registerMatchResult,
  type MatchResponse,
  type WalkoverSide,
} from '../../lib/api/tournamentBrackets'
import './RegisterResultSheet.css'

const SET_COUNT = 3

// Cópia exata do protótipo (sheet-to7) — AC explícito de "cópia exata", não
// paraphrasear. O backend ainda não envia notificação nenhuma ao "próximo
// jogo" (adiado deliberadamente pro Épico 10, decisão de 2026-07-23) — a
// UI promete uma capacidade planejada, mas não implementada; não há lógica
// de notificação nenhuma no frontend por trás desta frase.
const FOOTNOTE_TEXT =
  'Vencedor detectado pelo placar (2 de 3 sets). Confirmação avança a chave em tempo real e notifica o próximo jogo. Editável por 24h.'

const INCOMPLETE_SCORE_MESSAGE =
  'Placar incompleto: preencha ao menos 2 sets com um vencedor claro para cada dupla, ou marque WO.'

export interface RegisterResultSheetProps {
  matchId: string
  categoryLabel: string
  team1Name: string
  team2Name: string
  courtLabel?: string | null
  onSuccess: (match: MatchResponse) => void
  onCancel: () => void
}

type SetInputRow = { s1: string; s2: string }

function emptySets(): SetInputRow[] {
  return Array.from({ length: SET_COUNT }, () => ({ s1: '', s2: '' }))
}

/** Detecta o lado vencedor de cada set preenchido (placares diferentes) e,
 * se um lado já fechou 2 de 3, devolve esse lado — só pra feedback visual
 * client-side (AC): o backend detecta o vencedor de novo e é a fonte de
 * verdade. */
function detectWinnerSide(sets: SetInputRow[]): WalkoverSide | null {
  let team1Wins = 0
  let team2Wins = 0
  for (const set of sets) {
    if (set.s1 === '' || set.s2 === '') continue
    const n1 = Number(set.s1)
    const n2 = Number(set.s2)
    if (Number.isNaN(n1) || Number.isNaN(n2) || n1 === n2) continue
    if (n1 > n2) team1Wins++
    else team2Wins++
  }
  if (team1Wins >= 2) return 'registration1'
  if (team2Wins >= 2) return 'registration2'
  return null
}

function playedSets(sets: SetInputRow[]): { registration1Score: number; registration2Score: number }[] {
  return sets
    .filter((s) => s.s1 !== '' && s.s2 !== '')
    .map((s) => ({ registration1Score: Number(s.s1), registration2Score: Number(s.s2) }))
}

/**
 * TO7 — sheet "Registrar resultado" (BEAC-2008, story BEAC-1719). Markup
 * segue #sheet-to7 do protótipo real (h2 + subtítulo + grade de sets +
 * checkbox WO + foot-note). Reusa BottomSheet (ver TO6/MatchDetailPage,
 * que hospeda este componente como children) — este arquivo é só o
 * conteúdo do sheet, sem backdrop/painel próprios.
 *
 * O protótipo tem uma única checkbox WO genérica, sem seletor de lado
 * vencedor (a demo estática nunca precisou decidir isso) — mas o backend
 * exige `walkover: "registration1"|"registration2"`, então este componente
 * adiciona um seletor de lado (rádio) quando WO é marcado, além do que o
 * protótipo desenha.
 */
export function RegisterResultSheet({
  matchId,
  categoryLabel,
  team1Name,
  team2Name,
  courtLabel,
  onSuccess,
  onCancel,
}: RegisterResultSheetProps) {
  const [sets, setSets] = useState<SetInputRow[]>(emptySets)
  const [wo, setWo] = useState(false)
  const [woWinner, setWoWinner] = useState<WalkoverSide | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectedWinner = wo ? null : detectWinnerSide(sets)
  const subtitle = [categoryLabel, `${team1Name} × ${team2Name}`, courtLabel]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

  function updateSet(index: number, side: 's1' | 's2', value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [side]: value } : s)))
  }

  async function handleSubmit() {
    setError(null)

    if (wo) {
      if (!woWinner) {
        setError('Selecione quem venceu por WO.')
        return
      }
    } else if (!detectedWinner) {
      setError(INCOMPLETE_SCORE_MESSAGE)
      return
    }

    setSubmitting(true)
    const result = wo
      ? await registerMatchResult(matchId, { walkover: woWinner as WalkoverSide })
      : await registerMatchResult(matchId, { sets: playedSets(sets) })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.message ?? `Não foi possível registrar o resultado (${result.error}).`)
      return
    }

    onSuccess(result.match)
  }

  return (
    <div className="register-result-sheet">
      <h2>Registrar resultado</h2>
      <p className="ssub">{subtitle}</p>

      <div className="stack">
        <div className="set-in">
          <span className="tn" />
          <span className="set-label">SET 1</span>
          <span className="set-label">SET 2</span>
          <span className="set-label">SET 3</span>
        </div>
        <div className="set-in" data-testid="set-row-team1">
          <span className="tn">{team1Name}</span>
          {sets.map((set, i) => (
            <input
              key={i}
              type="number"
              inputMode="numeric"
              role="spinbutton"
              aria-label={`${team1Name} — set ${i + 1}`}
              value={set.s1}
              disabled={wo || submitting}
              onChange={(e) => updateSet(i, 's1', e.target.value)}
            />
          ))}
        </div>
        <div className="set-in" data-testid="set-row-team2">
          <span className="tn">{team2Name}</span>
          {sets.map((set, i) => (
            <input
              key={i}
              type="number"
              inputMode="numeric"
              role="spinbutton"
              aria-label={`${team2Name} — set ${i + 1}`}
              value={set.s2}
              disabled={wo || submitting}
              onChange={(e) => updateSet(i, 's2', e.target.value)}
            />
          ))}
        </div>

        <label className={`radio-opt${wo ? ' checked' : ''}`}>
          <input
            type="checkbox"
            checked={wo}
            disabled={submitting}
            onChange={(e) => {
              setWo(e.target.checked)
              setWoWinner(null)
            }}
          />
          <span>WO (walkover) — pula o placar</span>
        </label>

        {wo ? (
          <div className="wo-winner-picker" role="radiogroup" aria-label="Quem venceu por WO">
            <label className={`radio-opt${woWinner === 'registration1' ? ' checked' : ''}`}>
              <input
                type="radio"
                name="wo-winner"
                checked={woWinner === 'registration1'}
                disabled={submitting}
                onChange={() => setWoWinner('registration1')}
              />
              <span>{team1Name}</span>
            </label>
            <label className={`radio-opt${woWinner === 'registration2' ? ' checked' : ''}`}>
              <input
                type="radio"
                name="wo-winner"
                checked={woWinner === 'registration2'}
                disabled={submitting}
                onChange={() => setWoWinner('registration2')}
              />
              <span>{team2Name}</span>
            </label>
          </div>
        ) : null}

        {detectedWinner ? (
          <p className="detected-winner" data-testid="detected-winner">
            Vencedor detectado: {detectedWinner === 'registration1' ? team1Name : team2Name}
          </p>
        ) : null}

        {error ? <p role="alert">{error}</p> : null}

        <button
          type="button"
          className="btn btn-primary btn-md btn-full"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Confirmar resultado
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-md btn-full"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancelar
        </button>

        <div className="foot-note">{FOOTNOTE_TEXT}</div>
      </div>
    </div>
  )
}
