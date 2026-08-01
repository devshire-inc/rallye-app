import { useState } from 'react'
import { Button } from '../../components/ui/Button/Button'
import { Checkbox } from '../../components/ui/Checkbox/Checkbox'
import { Input } from '../../components/ui/Input/Input'
import { Radio } from '../../components/ui/Radio/Radio'
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
 *
 * ## Reskin design system
 *
 * O sheet não tem frame próprio no Figma "Rallye — Protótipo" (as telas 19–21
 * cobrem Chave, Detalhe da Partida e Rankings; o sheet de resultado não é
 * desenhado em nenhuma delas). Então aqui o reskin é o que dá para fazer sem
 * inventar layout: trocar os controles crus pelos primitivos do DS
 * (`ui/Input`, `ui/Checkbox`, `ui/Radio`, `ui/Button`, que trazem foco,
 * estado desabilitado e contraste já resolvidos) e prefixar as classes locais
 * com `.rrs-` — `.set-in`, `.radio-opt`, `.stack` e `.foot-note` eram nomes
 * genéricos, e `.radio-opt`/`.foot-note` são declarados também por outras
 * telas do bundle. A estrutura e todos os rótulos ficam idênticos.
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
      <h2 className="rrs-title">Registrar resultado</h2>
      <p className="rrs-subtitle">{subtitle}</p>

      <div className="rrs-stack">
        <div className="rrs-set-row rrs-set-row--head" aria-hidden="true">
          <span />
          <span className="rrs-set-label">SET 1</span>
          <span className="rrs-set-label">SET 2</span>
          <span className="rrs-set-label">SET 3</span>
        </div>
        <div className="rrs-set-row" data-testid="set-row-team1">
          <span className="rrs-set-team">{team1Name}</span>
          {sets.map((set, i) => (
            <Input
              key={i}
              size="sm"
              type="number"
              inputMode="numeric"
              role="spinbutton"
              wrapperClassName="rrs-set-input"
              ariaLabel={`${team1Name} — set ${i + 1}`}
              value={set.s1}
              disabled={wo || submitting}
              onChange={(e) => updateSet(i, 's1', e.target.value)}
            />
          ))}
        </div>
        <div className="rrs-set-row" data-testid="set-row-team2">
          <span className="rrs-set-team">{team2Name}</span>
          {sets.map((set, i) => (
            <Input
              key={i}
              size="sm"
              type="number"
              inputMode="numeric"
              role="spinbutton"
              wrapperClassName="rrs-set-input"
              ariaLabel={`${team2Name} — set ${i + 1}`}
              value={set.s2}
              disabled={wo || submitting}
              onChange={(e) => updateSet(i, 's2', e.target.value)}
            />
          ))}
        </div>

        <div className={`rrs-option${wo ? ' rrs-option--checked' : ''}`}>
          <Checkbox
            label="WO (walkover) — pula o placar"
            checked={wo}
            disabled={submitting}
            onChange={(checked) => {
              setWo(checked)
              setWoWinner(null)
            }}
          />
        </div>

        {wo ? (
          <div className="rrs-wo-picker" role="radiogroup" aria-label="Quem venceu por WO">
            <div
              className={`rrs-option${woWinner === 'registration1' ? ' rrs-option--checked' : ''}`}
            >
              <Radio
                label={team1Name}
                name="wo-winner"
                checked={woWinner === 'registration1'}
                disabled={submitting}
                onChange={() => setWoWinner('registration1')}
              />
            </div>
            <div
              className={`rrs-option${woWinner === 'registration2' ? ' rrs-option--checked' : ''}`}
            >
              <Radio
                label={team2Name}
                name="wo-winner"
                checked={woWinner === 'registration2'}
                disabled={submitting}
                onChange={() => setWoWinner('registration2')}
              />
            </div>
          </div>
        ) : null}

        {detectedWinner ? (
          <p className="rrs-detected" data-testid="detected-winner">
            Vencedor detectado: {detectedWinner === 'registration1' ? team1Name : team2Name}
          </p>
        ) : null}

        {error ? (
          <p className="rrs-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button variant="primary" size="md" fullWidth disabled={submitting} onClick={handleSubmit}>
          Confirmar resultado
        </Button>
        <Button variant="ghost" size="md" fullWidth disabled={submitting} onClick={onCancel}>
          Cancelar
        </Button>

        <p className="rrs-footnote">{FOOTNOTE_TEXT}</p>
      </div>
    </div>
  )
}
