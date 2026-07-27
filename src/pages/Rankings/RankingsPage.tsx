import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getMe } from '../../lib/api/me'
import { getRankings, type RankingEntry, type RankingScope } from '../../lib/api/rankings'
import { getActiveUnitId } from '../../lib/tenantContext'
import '../../components/AuthLayout/AuthLayout.css'
import './RankingsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rankings: RankingEntry[] }

const TOP_LIST_SIZE = 50

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/**
 * TO8 — Rankings (BEAC-2009, story BEAC-1719). Markup segue scr-to8 do
 * protótipo real (pódio + lista numerada). Consome GET /rankings (Épico 4,
 * BEAC-1855) sem nenhum endpoint novo — ver ../../lib/api/rankings.ts.
 *
 * Duas reduções deliberadas de escopo em relação ao protótipo/AC, ambas por
 * limitação do backend hoje (não é um bug desta tela, é o que o contrato
 * atual permite):
 * - Sem filtro de esporte: GET /rankings agrega total_points sem nenhuma
 *   dimensão de esporte (tournament_ranking_points não guarda isso) — a
 *   tab de esporte do protótipo não teria o que filtrar, então não existe
 *   aqui.
 * - Sem seta de tendência (▲/▼/—): a resposta não inclui nenhum dado de
 *   posição anterior — mostrar uma seta aqui seria inventar dado.
 * - Abas "Cidade"/"Estado" ficam desabilitadas (mesmo padrão de item de
 *   menu "inerte" já usado em AppShell para o que ainda não tem rota):
 *   apesar do backend aceitar ?scope=cidade|estado&city=|state=, não existe
 *   hoje nenhum endpoint que devolva o city/state da própria arena do
 *   usuário logado pra preencher esse parâmetro sem pedir uma digitação
 *   manual que o protótipo não desenha.
 */
export default function RankingsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const [scope, setScope] = useState<RankingScope>('arena')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) setMyId(result.id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const unitId = getActiveUnitId()
      const request =
        scope === 'arena' && !unitId
          ? Promise.reject(new Error('missing_unit_id'))
          : getRankings(scope === 'arena' ? { scope, unitId: unitId ?? undefined } : { scope })
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', rankings: result.rankings })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [scope],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const rankings = state.status === 'ready' ? state.rankings : []
  const top3 = rankings.slice(0, 3)
  const rest = rankings.slice(3, TOP_LIST_SIZE)
  const meIndex = myId ? rankings.findIndex((r) => r.studentId === myId) : -1
  const meOutsideList = meIndex >= TOP_LIST_SIZE

  function podiumRow(entry: RankingEntry, place: 1 | 2 | 3) {
    const placeClass = place === 1 ? 'first' : place === 2 ? 'second' : 'third'
    const isMe = entry.studentId === myId
    return (
      <div className={`p ${placeClass}`} key={entry.studentId}>
        <span className="avatar-sm">{initials(entry.name)}</span>
        <span className="pn">
          {entry.name}
          {isMe ? <span className="me-badge">VOCÊ</span> : null}
        </span>
        <span className="pp">{entry.totalPoints} pts</span>
        <div className="base">{place}</div>
      </div>
    )
  }

  function listRow(entry: RankingEntry, position: number) {
    const isMe = entry.studentId === myId
    return (
      <div
        className={`rk-row${isMe ? ' me' : ''}`}
        key={entry.studentId}
        data-testid={`ranking-row-${entry.studentId}`}
      >
        <span className="pos">{position}</span>
        <span className="avatar-sm">{initials(entry.name)}</span>
        <span className="rn">
          {entry.name}
          {isMe ? <span className="me-badge">VOCÊ</span> : null}
        </span>
        <span className="rp">{entry.totalPoints}</span>
      </div>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Rankings</h1>
        <div className="spacer" />
      </div>

      <div className="tabs2" role="tablist">
        {(
          [
            { key: 'arena', label: 'Arena' },
            { key: 'cidade', label: 'Cidade' },
            { key: 'estado', label: 'Estado' },
            { key: 'nacional', label: 'Nacional' },
          ] as { key: RankingScope; label: string }[]
        ).map(({ key, label }) => {
          const disabled = key === 'cidade' || key === 'estado'
          return (
            <button
              type="button"
              role="tab"
              key={key}
              aria-selected={scope === key}
              className={scope === key ? 'active' : ''}
              disabled={disabled}
              title={disabled ? 'Em breve — ainda não é possível resolver a cidade/estado da sua arena.' : undefined}
              onClick={() => setScope(key)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="dash-body" style={{ maxWidth: 560 }}>
        {state.status === 'loading' ? (
          <p role="status">Carregando ranking…</p>
        ) : state.status === 'error' ? (
          <p role="alert">Não foi possível carregar o ranking.</p>
        ) : (
          <>
            <div className="podium" data-testid="podium">
              {top3[1] ? podiumRow(top3[1], 2) : null}
              {top3[0] ? podiumRow(top3[0], 1) : null}
              {top3[2] ? podiumRow(top3[2], 3) : null}
            </div>

            <div className="ag-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rest.map((entry, i) => listRow(entry, i + 4))}
              {meOutsideList && meIndex >= 0 ? listRow(rankings[meIndex], meIndex + 1) : null}
            </div>

            <p className="foot-note">
              {rankings.length} {rankings.length === 1 ? 'jogador' : 'jogadores'} no ranking
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
