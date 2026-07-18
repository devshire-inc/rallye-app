import { useCallback, useEffect, useState } from 'react'
import { usePermission } from '../../hooks/usePermission'
import {
  listSkillLevels,
  patchSkillLevel,
  SKILL_TIERS,
  type SkillLevel,
  type SkillTier,
} from '../../lib/api/skillLevels'
import { sportCssVar, sportLabel } from '../../lib/sports'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; skillLevels: SkillLevel[] }

// Cópia exata do protótipo real (scr-al2, Artifact "Rallye — Pessoas &
// Turmas") — não parafrasear.
const HINT_TEXT =
  'Editável por Admin e Professor. Um valor por esporte praticado — não é um campo único "nível do aluno".'

export interface SkillLevelsSectionProps {
  studentId: string
}

/**
 * BEAC-1856 (story BEAC-1691) — seção "Nível por esporte" da aba Dados de
 * AL2. Markup/cópia seguem o protótipo real (scr-al2, lido diretamente do
 * Artifact antes de implementar, não parafraseado da task): uma linha de
 * chips (`data-tier-group="{sport}"`) por esporte PRATICADO pelo aluno — a
 * lista de esportes vem diretamente de `GET /students/{id}/skill-levels`
 * (BEAC-1853, handler real lido em
 * rallye-api-beac1690/api/internal/skilllevels/handler.go), nunca uma lista
 * separada (decisão travada). `data-tier-group` usa o slug REAL da API
 * (beach_tennis/padel/futevolei/volei), não a abreviação do protótipo
 * ("bt") — precisa bater com o `{sport}` usado no PATCH.
 *
 * Regra "esconder sempre, nunca desabilitar" (usePermission.ts, Épico 3):
 * sem `alunos:write`, os chips viram uma apresentação somente-leitura —
 * `<span>`, nunca um `<button disabled>` (não existe elemento interativo
 * pra esconder/desabilitar; a affordance clicável simplesmente não é
 * renderizada).
 */
export function SkillLevelsSection({ studentId }: SkillLevelsSectionProps) {
  const canWrite = usePermission('alunos', 'write')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [pendingSport, setPendingSport] = useState<string | null>(null)
  const [errorSport, setErrorSport] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      listSkillLevels(studentId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', skillLevels: result.skillLevels })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [studentId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleSelect(sport: string, tier: SkillTier) {
    if (state.status !== 'ready') return
    const previous = state.skillLevels
    const current = previous.find((s) => s.sport === sport)
    if (current?.tier === tier) return // já selecionado — no-op

    setErrorSport(null)
    setPendingSport(sport)
    // Otimista: reflete a troca imediatamente (AC "reflete imediatamente"),
    // com rollback se o PATCH falhar.
    setState({
      status: 'ready',
      skillLevels: previous.map((s) => (s.sport === sport ? { ...s, tier } : s)),
    })

    const result = await patchSkillLevel(studentId, sport, tier)
    setPendingSport(null)
    if (!result.ok) {
      setState({ status: 'ready', skillLevels: previous })
      setErrorSport(sport)
    }
  }

  return (
    <div className="level-section">
      <div className="sec-head">
        <h2>Nível por esporte</h2>
      </div>

      {state.status === 'loading' ? <p role="status">Carregando níveis…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar os níveis deste aluno.</p>
      ) : null}
      {state.status === 'ready' && state.skillLevels.length === 0 ? (
        <p className="hint">Nenhum esporte com nível registrado ainda.</p>
      ) : null}

      {state.status === 'ready' && state.skillLevels.length > 0 ? (
        <div className="level-rows">
          {state.skillLevels.map((skillLevel) => (
            <div key={skillLevel.sport} className="level-row">
              <div className="level-row-label">
                <span
                  className="sdot"
                  style={{ background: `var(${sportCssVar(skillLevel.sport)})` }}
                />
                {sportLabel(skillLevel.sport)}
              </div>
              <div className="chiprow" data-tier-group={skillLevel.sport}>
                {SKILL_TIERS.map((tier) =>
                  canWrite ? (
                    <button
                      key={tier.value}
                      type="button"
                      className="chip"
                      aria-pressed={skillLevel.tier === tier.value}
                      disabled={pendingSport === skillLevel.sport}
                      onClick={() => handleSelect(skillLevel.sport, tier.value)}
                    >
                      {tier.label}
                    </button>
                  ) : (
                    <span
                      key={tier.value}
                      className={skillLevel.tier === tier.value ? 'chip chip--selected' : 'chip'}
                    >
                      {tier.label}
                    </span>
                  ),
                )}
              </div>
              {errorSport === skillLevel.sport ? (
                <p role="alert" className="hint">
                  Não foi possível salvar o novo nível. Tente novamente.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="hint">{HINT_TEXT}</div>
    </div>
  )
}
