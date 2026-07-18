import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { usePermission } from '../../hooks/usePermission'
import {
  getDelinquencyBlockLevel,
  patchDelinquencyBlockLevel,
  type DelinquencyBlockLevel,
} from '../../lib/api/unitSettings'
import '../../components/AuthLayout/AuthLayout.css'
import './ArenaSettingsPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; level: DelinquencyBlockLevel }

type SaveState = { status: 'idle' } | { status: 'saving' } | { status: 'error' }

const LEVEL_OPTIONS: Array<{ value: DelinquencyBlockLevel; label: string; note?: string }> = [
  {
    value: 'new_bookings_only',
    label: 'Só novos agendamentos/remarcações',
    note: 'default — o resto do app continua liberado',
  },
  {
    value: 'new_bookings_and_checkin',
    label: 'Também bloqueia check-in de aulas futuras já marcadas',
  },
  { value: 'total', label: 'Bloqueio total de acesso à arena' },
]

// Cópia exata locked pelo protótipo C1 (Artifact "Rallye — Perfil & Config ·
// Saque Noturno", claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5,
// seção scr-c1, linha ~890) — hint fixo, igual não importa o nível
// escolhido (AC de BEAC-1867: "Loja/Torneios nunca são bloqueados,
// independente da opção").
const NEVER_BLOCKED_HINT_TEXT =
  'Loja e inscrição em torneio nunca são bloqueadas por inadimplência, em nenhum nível. Reverte automaticamente ao pagar.'

/**
 * C1 — Configurações da arena, seção "Bloqueio por inadimplência" (BEAC-1867,
 * story BEAC-1694, 3ª e última task da story — BEAC-1865/migration e
 * BEAC-1866/endpoint já Done). Protótipo real lido diretamente antes de
 * implementar (não parafraseado de memória) — Artifact "Rallye — Perfil &
 * Config · Saque Noturno"
 * (claude.ai/code/artifact/3a67a9a8-70b7-4af1-bc1a-96dabfbc70a5), seção
 * `id="scr-c1"` (linhas ~858-892 do HTML da seção): cabeçalho "Configurações
 * da arena" + `.set-title` "Bloqueio por inadimplência" + 3 `.radio-opt`
 * (grupo `c1bloq` no protótipo) + hint fixo sobre Loja/Torneios + botão
 * "Salvar".
 *
 * Escopo desta task: só esta seção. As outras seções de C1 do protótipo
 * (Dados, Regras de agendamento — Day Use já saiu de C1 no próprio
 * protótipo, virou tela própria DU5) são de outras stories, ainda não
 * construídas aqui — mesmo padrão incremental já usado por RolesPage (só
 * "Papéis" -> depois "Histórico" reconciliado) e MembersPage.
 *
 * Contrato do endpoint (BEAC-1866, já Done): confirmado lendo
 * api/internal/unitsettings/handler.go direto no worktree da story irmã, em
 * vez de assumir pela descrição da task — GET/PATCH
 * /units/{id}/settings/delinquency-block-level, corpo flat/snake_case
 * `{"delinquency_block_level": "<value>"}` nos dois verbos (ver
 * ../../lib/api/unitSettings.ts).
 *
 * Permissão (Épico 3): sem `config:read`, a seção inteira não é renderizada
 * (nem o `.set-title`) — nenhuma pista de que ela existe ("esconder
 * sempre"). Com `config:read` mas sem `config:write`, a seção aparece
 * (config:read sozinho permite visualizar), porém sem nenhum
 * `<input type="radio">` interativo nem botão "Salvar" — só os 3 valores em
 * modo leitura, com o atual marcado via `.radio-opt.checked`. Só com
 * `config:write` os radios viram controles reais e o Salvar aparece.
 */
export default function ArenaSettingsPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const canRead = usePermission('config', 'read')
  const canWrite = usePermission('config', 'write')

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<DelinquencyBlockLevel | null>(null)
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })

  // `canRead` é `false` tanto "permanentemente negado" quanto "ainda não
  // sabemos" (usePermission devolve false antes do primeiro fetch de
  // /me/permissions completar, ver hooks/usePermission.ts) — não dá pra
  // distinguir os dois casos por aqui, e não precisa: como a seção inteira
  // não é renderizada enquanto `!canRead` (ver JSX abaixo), não fazemos
  // fetch nenhum nesse meio-tempo, e o estado interno (ainda 'loading',
  // valor inicial) simplesmente não é exibido. Quando `canRead` vira `true`
  // (permissions resolvidas com leitura concedida), a mudança de valor
  // troca a identidade de `load` (dependência abaixo) e o efeito reroda,
  // disparando o fetch de verdade pela primeira vez.
  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId || !canRead) return
      getDelinquencyBlockLevel(unitId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', level: result.level })
          setSelected(result.level)
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, canRead],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleSave() {
    if (!unitId || !selected || saveState.status === 'saving') return
    setSaveState({ status: 'saving' })
    const result = await patchDelinquencyBlockLevel(unitId, selected)
    if (!result.ok) {
      setSaveState({ status: 'error' })
      return
    }
    setSaveState({ status: 'idle' })
    setState({ status: 'ready', level: result.level })
    setSelected(result.level)
  }

  // Extraído fora do JSX para evitar depender de narrowing de `state`
  // dentro do closure de `.map()` abaixo (TS não estreita `state.status`
  // dentro de uma função aninhada).
  const currentLevel = state.status === 'ready' ? state.level : null

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <Link className="back" to="/perfil">
          ‹ Perfil
        </Link>
        <h1>Configurações da arena</h1>
        <div className="spacer" />
      </div>

      <div className="dash-body">
        {!canRead ? null : state.status === 'loading' ? (
          <p role="status">Carregando configurações…</p>
        ) : state.status === 'error' ? (
          <p role="alert">Não foi possível carregar as configurações desta arena.</p>
        ) : (
          <>
            <div className="set-title">Bloqueio por inadimplência</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEVEL_OPTIONS.map((option) =>
                canWrite ? (
                  <label
                    key={option.value}
                    className={`radio-opt${selected === option.value ? ' checked' : ''}`}
                  >
                    <input
                      type="radio"
                      name="c1bloq"
                      checked={selected === option.value}
                      onChange={() => setSelected(option.value)}
                    />
                    <span className="rl" style={{ flex: 1 }}>
                      {option.label}
                      {option.note ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                          }}
                        >
                          {option.note}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ) : (
                  <div
                    key={option.value}
                    className={`radio-opt readonly${currentLevel === option.value ? ' checked' : ''}`}
                    data-testid={`bloqueio-readonly-${option.value}`}
                  >
                    <span className="rl" style={{ flex: 1 }}>
                      {option.label}
                      {option.note ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                          }}
                        >
                          {option.note}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ),
              )}
            </div>

            <div className="hint" style={{ fontSize: 11.5 }}>
              {NEVER_BLOCKED_HINT_TEXT}
            </div>

            {saveState.status === 'error' ? (
              <p role="alert">Não foi possível salvar. Tente novamente.</p>
            ) : null}

            {canWrite ? (
              <button
                type="button"
                className="btn btn-primary btn-md"
                style={{ alignSelf: 'flex-start' }}
                onClick={handleSave}
                disabled={saveState.status === 'saving' || selected === currentLevel}
              >
                {saveState.status === 'saving' ? 'Salvando…' : 'Salvar'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  )
}
