import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { usePermission } from '../../hooks/usePermission'
import { useTournamentLive } from '../../hooks/useTournamentLive'
import { getMatch, type MatchDetailResponse, type MatchSet } from '../../lib/api/tournamentBrackets'
import { RegisterResultSheet } from './RegisterResultSheet'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './MatchDetailPage.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; match: MatchDetailResponse }

const SET_COLUMNS = 3

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

function courtLabel(courtId: string | null): string {
  return courtId ? `Quadra #${courtId.slice(0, 4)}` : 'Quadra a definir'
}

function currentSet(sets: MatchSet[]): MatchSet {
  if (sets.length === 0) return { setNumber: 1, registration1Score: 0, registration2Score: 0 }
  return sets.reduce((latest, s) => (s.setNumber > latest.setNumber ? s : latest))
}

/**
 * TO6 — Detalhe da Partida (BEAC-2007, story BEAC-1719). Markup segue
 * scr-to6 do protótipo real (score hero + tabela de sets). Estatísticas de
 * comparação são opcionais no MVP (AC explícito) — não implementadas.
 *
 * O badge do pg-head do protótipo mostra "Quartas · Fem B" (rodada +
 * categoria) — resolver o nome da categoria exigiria mais uma chamada
 * (GET /tournaments/{id}) só para isso, e não está nos ACs explícitos
 * desta tela (só o badge do score-hero, "SET N · AO VIVO · QUADRA X" ou
 * "FINAL", está); por isso o pg-head aqui mostra só "Rodada {round}".
 *
 * O backend só tem status pending/completed/walkover — sem "próximo" vs
 * "ao vivo" (mesmo gap documentado em BracketPage.tsx). O AC desta tela só
 * descreve 2 estados de badge ("AO VIVO" ou "FINAL"), então — diferente de
 * BracketPage — aqui pending sempre mostra "AO VIVO" (é o que o AC pede
 * literalmente), sem o heurístico de "próximo" da tela de chaves.
 *
 * Dados via GET /tournament-matches/{id} (BEAC-2012), com sets e nomes já
 * resolvidos pelo backend. Atualização automática via SSE (BEAC-2011,
 * useTournamentLive) — só refaz o GET quando o evento é desta partida
 * específica (diferente de BracketPage, que não tem como filtrar por
 * partida porque mostra uma categoria inteira).
 */
export default function MatchDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sheetOpen, setSheetOpen] = useState(false)
  const canRegisterResult = usePermission('torneios', 'write')

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request = matchId ? getMatch(matchId) : Promise.reject(new Error('missing_match_id'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', match: result.match })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [matchId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  useTournamentLive(tournamentId, (changedMatchId) => {
    if (changedMatchId === matchId) load(() => false)
  })

  const match = state.status === 'ready' ? state.match : null
  const isFinal = match?.status === 'completed' || match?.status === 'walkover'
  const live = match ? currentSet(match.sets) : null

  /** registerMatchResult devolve um MatchResponse (sem sets/nomes — o
   * POST /tournament-matches/{id}/result não os ecoa de volta, só as leituras
   * de BEAC-2012 têm isso) — refaz o GET pra ter o MatchDetailResponse
   * completo em vez de tentar remendar o estado com um shape parcial. */
  function handleRegisterSuccess() {
    load(() => false)
    setSheetOpen(false)
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={tournamentId ? `/tournaments/${tournamentId}/bracket` : '#'}>
          ‹ Chaves
        </Link>
        <div className="spacer" />
        {match ? <Badge tone="neutral">Rodada {match.round}</Badge> : null}
      </div>

      <div className="dash-body" style={{ maxWidth: 560 }}>
        {state.status === 'loading' ? (
          <PageLoading label="Carregando partida" variant="section" />
        ) : state.status === 'error' ? (
          <p role="alert">Não foi possível carregar a partida.</p>
        ) : match && live ? (
          <>
            <div className="score-hero" data-testid="score-hero">
              <div className="hero-badge">
                {isFinal ? 'FINAL' : `SET ${live.setNumber} · AO VIVO · ${courtLabel(match.courtId).toUpperCase()}`}
              </div>
              <div className="teams">
                <div className="team">
                  <div className="avs">
                    <span className="avatar-sm">{initials(match.registration1Name ?? 'A definir')}</span>
                  </div>
                  <div className="tn">{match.registration1Name ?? 'A definir'}</div>
                </div>
                <div className="big">
                  <span>{live.registration1Score}</span>
                  <span className="x">×</span>
                  <span>{live.registration2Score}</span>
                </div>
                <div className="team">
                  <div className="avs">
                    <span className="avatar-sm">{initials(match.registration2Name ?? 'A definir')}</span>
                  </div>
                  <div className="tn">{match.registration2Name ?? 'A definir'}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="sec-head">
                <h2>Sets</h2>
              </div>
              <table className="set-table">
                <thead>
                  <tr>
                    <th>Dupla</th>
                    {Array.from({ length: SET_COLUMNS }, (_, i) => (
                      <th key={i}>Set {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{match.registration1Name ?? 'A definir'}</td>
                    {Array.from({ length: SET_COLUMNS }, (_, i) => {
                      const set = match.sets.find((s) => s.setNumber === i + 1)
                      const won = set && set.registration1Score > set.registration2Score
                      return (
                        <td key={i} className={won ? 'w' : undefined}>
                          {set ? set.registration1Score : '—'}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>{match.registration2Name ?? 'A definir'}</td>
                    {Array.from({ length: SET_COLUMNS }, (_, i) => {
                      const set = match.sets.find((s) => s.setNumber === i + 1)
                      const won = set && set.registration2Score > set.registration1Score
                      return (
                        <td key={i} className={won ? 'w' : undefined}>
                          {set ? set.registration2Score : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {canRegisterResult ? (
              <button type="button" className="btn btn-primary btn-md" onClick={() => setSheetOpen(true)}>
                Registrar resultado (admin)
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Registrar resultado">
        {match ? (
          <RegisterResultSheet
            matchId={match.id}
            categoryLabel={`Rodada ${match.round}`}
            team1Name={match.registration1Name ?? 'A definir'}
            team2Name={match.registration2Name ?? 'A definir'}
            courtLabel={courtLabel(match.courtId)}
            onSuccess={handleRegisterSuccess}
            onCancel={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
