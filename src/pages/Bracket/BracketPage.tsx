import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { useTournamentLive } from '../../hooks/useTournamentLive'
import {
  getTournamentBracketInfo,
  listCategoryMatches,
  type BracketCategory,
  type MatchDetailResponse,
  type TournamentBracketInfo,
} from '../../lib/api/tournamentBrackets'
import '../../components/AuthLayout/AuthLayout.css'
import './BracketPage.css'

type TournamentLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; tournament: TournamentBracketInfo }

type MatchesLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; matches: MatchDetailResponse[] }

const BRACKET_FORMATS = new Set(['single_elimination', 'double_elimination'])

/** "QUARTAS"/"SEMI"/"FINAL" contados de trás pra frente a partir da última
 * rodada (a final é sempre round === maxRound, não importa quantas rodadas
 * o formato tem) — não existe nenhum campo de label pronto no backend. */
function roundLabel(round: number, maxRound: number): string {
  const fromEnd = maxRound - round
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinal'
  if (fromEnd === 2) return 'Quartas'
  if (fromEnd === 3) return 'Oitavas'
  return `Rodada ${round}`
}

/** O backend só devolve status pending/completed/walkover — sem nenhum
 * estado "ao vivo" explícito. "Ao vivo" aqui é um heurístico client-side
 * (pending + já tem quadra + já devia ter começado pelo scheduled_at),
 * não um dado que o backend garante. */
function matchState(match: MatchDetailResponse): 'done' | 'live' | 'next' {
  if (match.status === 'completed' || match.status === 'walkover') return 'done'
  const scheduled = match.scheduledAt ? new Date(match.scheduledAt).getTime() : null
  if (match.courtId && scheduled !== null && scheduled <= Date.now()) return 'live'
  return 'next'
}

function formatTime(iso: string): string {
  return iso.slice(11, 16)
}

function courtLabel(courtId: string | null): string | null {
  return courtId ? `Quadra #${courtId.slice(0, 4)}` : null
}

function duoLabel(name: string | null): string {
  return name ?? 'A definir'
}

interface MatchCardProps {
  match: MatchDetailResponse
  onOpen: (matchId: string) => void
}

function MatchCard({ match, onOpen }: MatchCardProps) {
  const state = matchState(match)
  const court = courtLabel(match.courtId)

  let statusText: string
  if (state === 'done') {
    statusText = '✓ Finalizado'
  } else if (state === 'live') {
    statusText = court ? `● Ao vivo · ${court}` : '● Ao vivo'
  } else if (match.scheduledAt) {
    statusText = court ? `⏳ ${formatTime(match.scheduledAt)} · ${court}` : `⏳ ${formatTime(match.scheduledAt)}`
  } else {
    statusText = court ? `⏳ ${court}` : '⏳ A definir'
  }

  return (
    <button
      type="button"
      className={`match${state === 'live' ? ' live' : ''}${state === 'done' ? ' done' : ''}`}
      data-testid={`match-card-${match.id}`}
      onClick={() => onOpen(match.id)}
    >
      <div
        className={`mrow${match.winnerRegistrationId && match.winnerRegistrationId === match.registration1Id ? ' win' : ''}`}
      >
        <span className="duo">{duoLabel(match.registration1Name)}</span>
        <span className="sc">{match.sets[0]?.registration1Score ?? '—'}</span>
      </div>
      <div
        className={`mrow${match.winnerRegistrationId && match.winnerRegistrationId === match.registration2Id ? ' win' : ''}`}
      >
        <span className="duo">{duoLabel(match.registration2Name)}</span>
        <span className="sc">{match.sets[0]?.registration2Score ?? '—'}</span>
      </div>
      <div className="mstatus">{statusText}</div>
    </button>
  )
}

function BracketColumnsView({
  matches,
  onOpen,
}: {
  matches: MatchDetailResponse[]
  onOpen: (matchId: string) => void
}) {
  const maxRound = Math.max(...matches.map((m) => m.round))
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)

  return (
    <div className="bracket-wrap" data-testid="bracket-columns-view">
      <div className="bracket">
        {rounds.map((round) => (
          <div className="b-round" key={round}>
            <div className="rlabel">{roundLabel(round, maxRound)}</div>
            {matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.positionInRound - b.positionInRound)
              .map((m) => (
                <MatchCard match={m} onOpen={onOpen} key={m.id} />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Formatos sem bracket de eliminação (round_robin/swiss/groups_knockout):
 * sem protótipo visual pra essa parte (AC explícito) — extensão própria,
 * mesmo padrão de "lista de cards" já usado em outras telas do app (ex.
 * presença em turmas: linhas dentro de cards, não uma <table> literal),
 * agrupada por rodada (swiss) ou grupo (groups_knockout, via group_id). */
function BracketTableView({
  matches,
  onOpen,
}: {
  matches: MatchDetailResponse[]
  onOpen: (matchId: string) => void
}) {
  const hasGroups = matches.some((m) => m.groupId)
  const groupKeyOf = (m: MatchDetailResponse) => (hasGroups ? (m.groupId ?? '—') : `round-${m.round}`)
  const groupKeys = [...new Set(matches.map(groupKeyOf))]

  return (
    <div className="bracket-table" data-testid="bracket-table-view">
      {groupKeys.map((key) => {
        const groupMatches = matches.filter((m) => groupKeyOf(m) === key)
        const label = hasGroups ? `Grupo ${key.slice(0, 4)}` : `Rodada ${groupMatches[0]?.round}`
        return (
          <div className="bt-group" key={key}>
            <div className="rlabel">{label}</div>
            <div className="bt-list">
              {groupMatches.map((m) => (
                <MatchCard match={m} onOpen={onOpen} key={m.id} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * TO5 — Chaves/Bracket (BEAC-2006, story BEAC-1719). Markup segue scr-to5
 * do protótipo real (tabs de categoria, rounds em coluna, match cards,
 * stats footer). Formatos sem eliminação (round robin/suíço/grupos) não
 * têm protótipo — ver BracketTableView acima.
 *
 * Dados via GET /tournament-categories/{id}/matches (BEAC-2012).
 * Atualização automática via SSE (BEAC-2011, useTournamentLive): qualquer
 * `match_changed` do torneio dispara um refetch da categoria ativa (o
 * evento só carrega o id da partida que mudou, não o estado novo — mais
 * simples e seguro refazer o GET da categoria inteira do que tentar casar
 * o id contra a categoria certa no cliente).
 */
export default function BracketPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [tournamentState, setTournamentState] = useState<TournamentLoadState>({ status: 'loading' })
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [matchesState, setMatchesState] = useState<MatchesLoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const request = tournamentId
      ? getTournamentBracketInfo(tournamentId)
      : Promise.reject(new Error('missing_tournament_id'))
    request
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setTournamentState({ status: 'error' })
          return
        }
        setTournamentState({ status: 'ready', tournament: result.tournament })
        setCategoryId((current) => current ?? (result.tournament.categories[0]?.id ?? null))
      })
      .catch(() => {
        if (cancelled) return
        setTournamentState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const loadMatches = useCallback(
    (onCancelled: () => boolean) => {
      if (!categoryId) return
      const request = listCategoryMatches(categoryId)
      request.then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setMatchesState({ status: 'error' })
          return
        }
        setMatchesState({ status: 'ready', matches: result.matches })
      })
    },
    [categoryId],
  )

  useEffect(() => {
    if (!categoryId) return
    let cancelled = false
    loadMatches(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [categoryId, loadMatches])

  useTournamentLive(tournamentId, () => loadMatches(() => false))

  function openMatch(matchId: string) {
    navigate(`/tournaments/${tournamentId}/matches/${matchId}`)
  }

  const categories: BracketCategory[] =
    tournamentState.status === 'ready' ? tournamentState.tournament.categories : []
  const activeCategory = categories.find((c) => c.id === categoryId) ?? null
  const matches = matchesState.status === 'ready' ? matchesState.matches : []
  const registrationCount = new Set(
    matches.flatMap((m) => [m.registration1Id, m.registration2Id].filter((id): id is string => Boolean(id))),
  ).size
  const finishedCount = matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={tournamentId ? `/tournaments/${tournamentId}` : '#'}>
          ‹ Torneio
        </Link>
        <h1>Chaves{activeCategory ? ` · ${activeCategory.name}` : ''}</h1>
        <div className="spacer" />
        {categories.length > 0 ? (
          <div className="tabs2" role="tablist">
            {categories.map((c) => (
              <button
                type="button"
                role="tab"
                key={c.id}
                aria-selected={c.id === categoryId}
                className={c.id === categoryId ? 'active' : ''}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="dash-body">
        {tournamentState.status === 'loading' ? (
          <p role="status">Carregando chaves…</p>
        ) : tournamentState.status === 'error' ? (
          <p role="alert">Não foi possível carregar o torneio.</p>
        ) : matchesState.status === 'loading' ? (
          <p role="status">Carregando partidas…</p>
        ) : matchesState.status === 'error' ? (
          <p role="alert">Não foi possível carregar as partidas desta categoria.</p>
        ) : matches.length === 0 ? (
          <p className="hint">Chaves serão divulgadas em breve.</p>
        ) : (
          <>
            {activeCategory && BRACKET_FORMATS.has(activeCategory.bracketFormat ?? '') ? (
              <BracketColumnsView matches={matches} onOpen={openMatch} />
            ) : (
              <BracketTableView matches={matches} onOpen={openMatch} />
            )}
            <div className="foot-note" style={{ textAlign: 'left' }}>
              {registrationCount} duplas · {matches.length} jogos · {finishedCount} finalizados
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
