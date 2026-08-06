import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge/Badge'
import { BracketRoundHeader } from '../../components/ui/BracketRoundHeader/BracketRoundHeader'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { MatchCard } from '../../components/ui/MatchCard/MatchCard'
import { Icon } from '../../components/ui/Icon/Icon'
import { useTournamentLive } from '../../hooks/useTournamentLive'
import {
  getTournamentBracketInfo,
  listCategoryMatches,
  type BracketCategory,
  type MatchDetailResponse,
  type TournamentBracketInfo,
} from '../../lib/api/tournamentBrackets'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
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

interface BracketMatchCardProps {
  match: MatchDetailResponse
  onOpen: (matchId: string) => void
}

/** Estado do card na chave -> estado do `ui/MatchCard`. "next" é o agendado do
 * componente; "done" cobre também o walkover, que aqui não vira `state="wo"`
 * de propósito: essa variante do componente apaga o placar e cola "(W.O.)" nos
 * dois nomes, e o frame desta tela desenha o encerrado sempre igual. */
const MATCH_CARD_STATE = {
  done: 'finished',
  live: 'live',
  next: 'scheduled',
} as const

/**
 * Confronto da chave (Figma 177:2368/177:2383 mobile, 188:3633 desktop):
 * duas linhas nome+placar e uma linha de status abaixo.
 *
 * É o `ui/MatchCard` do design system nas variantes de composição que esta
 * tela pediu (ver o comentário de pacote lá): `fluid` + `density="compact"`
 * (largura elástica e o respiro do frame), `statusPlacement="footer"` +
 * `statusLabel` (status livre numa linha própria), `divider={false}` e
 * `winnerStyle="emphasis"` (vencedor só por peso/cor, sem barra nem check).
 *
 * O card inteiro é o alvo de clique: `onClick` faz o componente virar um
 * `<button>` e leva o `aria-label` de frase montada para o próprio botão —
 * era exatamente o que impedia o uso antes (um `role="group"` aninhado num
 * `<button>` externo perderia a frase no nome acessível).
 */
function BracketMatchCard({ match, onOpen }: BracketMatchCardProps) {
  const state = matchState(match)
  const court = courtLabel(match.courtId)

  // Os glifos (✓/🔴/⏳) do frame entram por `::before` no CSS: o texto do DOM
  // fica limpo para leitor de tela e para os testes — mesmo padrão adotado
  // no reskin de TO1/TO3/TO4.
  let statusText: string
  if (state === 'done') {
    statusText = 'Finalizado'
  } else if (state === 'live') {
    statusText = court ? `Ao vivo · ${court}` : 'Ao vivo'
  } else if (match.scheduledAt) {
    statusText = court ? `${formatTime(match.scheduledAt)} · ${court}` : formatTime(match.scheduledAt)
  } else {
    // "Horário a definir", e não só "A definir": esse é também o rótulo de
    // uma dupla ainda não conhecida, e as duas coisas na mesma tela ficariam
    // ambíguas (para quem lê e para quem consulta a tela por texto).
    statusText = court ?? 'Horário a definir'
  }

  const winner1 = Boolean(match.winnerRegistrationId && match.winnerRegistrationId === match.registration1Id)
  const winner2 = Boolean(match.winnerRegistrationId && match.winnerRegistrationId === match.registration2Id)

  const cardState = MATCH_CARD_STATE[state]

  return (
    <MatchCard
      state={cardState}
      format="dupla"
      fluid
      density="compact"
      divider={false}
      winnerStyle="emphasis"
      statusPlacement="footer"
      statusLabel={statusText}
      // No agendado o mesmo texto também alimenta a frase do `aria-label`
      // ("... agendado para 14:00 · Quadra #ab").
      scheduledLabel={cardState === 'scheduled' ? statusText : undefined}
      onClick={() => onOpen(match.id)}
      data-testid={`match-card-${match.id}`}
      participants={[
        {
          name: duoLabel(match.registration1Name),
          sets: [match.sets[0]?.registration1Score ?? '—'],
          winner: winner1,
        },
        {
          name: duoLabel(match.registration2Name),
          sets: [match.sets[0]?.registration2Score ?? '—'],
          winner: winner2,
        },
      ]}
    />
  )
}

/** Uma rodada (mobile: seção empilhada; desktop: coluna da chave). Mesmo
 * DOM nos dois — quem troca empilhado por colunas é só o `flex-direction`
 * do `.brk-bracket`, ver BracketPage.css. */
function BracketRound({
  label,
  matches,
  onOpen,
}: {
  label: string
  matches: MatchDetailResponse[]
  onOpen: (matchId: string) => void
}) {
  return (
    <section className="brk-round" aria-label={label}>
      {/* `ui/BracketRoundHeader` na variante `plain`: o cabeçalho dos frames é
          texto puro (Overline em text/muted), sem a pílula de 240px do
          símbolo. */}
      <BracketRoundHeader round={label} variant="plain" headingLevel={2} />
      <div className="brk-round__list">
        {matches.map((m) => (
          <BracketMatchCard match={m} onOpen={onOpen} key={m.id} />
        ))}
      </div>
    </section>
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
    <div className="brk-scroll" data-testid="bracket-columns-view">
      <div className="brk-bracket">
        {rounds.map((round) => (
          <BracketRound
            key={round}
            label={roundLabel(round, maxRound)}
            matches={matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.positionInRound - b.positionInRound)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

/** Formatos sem bracket de eliminação (round_robin/swiss/groups_knockout):
 * sem protótipo visual pra essa parte (AC explícito) — extensão própria,
 * mesmo padrão de "lista de cards" já usado em outras telas do app (ex.
 * presença em turmas: linhas dentro de cards, não uma <table> literal),
 * agrupada por rodada (swiss) ou grupo (groups_knockout, via group_id).
 * Reusa o mesmo `BracketRound` da chave, mas sem virar colunas no desktop
 * (não há progressão de rodadas a representar horizontalmente). */
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
    <div className="brk-groups" data-testid="bracket-table-view">
      {groupKeys.map((key) => {
        const groupMatches = matches.filter((m) => groupKeyOf(m) === key)
        const label = hasGroups ? `Grupo ${key.slice(0, 4)}` : `Rodada ${groupMatches[0]?.round}`
        return <BracketRound key={key} label={label} matches={groupMatches} onOpen={onOpen} />
      })}
    </div>
  )
}

/**
 * TO5 — Chaves/Bracket (BEAC-2006, story BEAC-1719).
 *
 * Dados via GET /tournament-categories/{id}/matches (BEAC-2012).
 * Atualização automática via SSE (BEAC-2011, useTournamentLive): qualquer
 * `match_changed` do torneio dispara um refetch da categoria ativa (o
 * evento só carrega o id da partida que mudou, não o estado novo — mais
 * simples e seguro refazer o GET da categoria inteira do que tentar casar
 * o id contra a categoria certa no cliente).
 *
 * ## Reskin design system (Figma "19 · Torneios — Chave", node 177:2307
 * mobile / 187:6767 desktop / 186:3408 mobile Dark)
 *
 * Um único DOM para os dois layouts: `.brk-bracket` é uma pilha de seções
 * de rodada no mobile (frame 177:2307: "Quartas de final", "Semifinal",
 * "Próximo jogo", cada uma com os seus cards em coluna cheia) e vira uma
 * linha de colunas de 320px no desktop (frame 187:6767: QUARTAS DE FINAL /
 * SEMIFINAL / FINAL lado a lado, gap 40). Só o `flex-direction` muda —
 * nenhum conteúdo é duplicado no DOM, ao contrário do padrão
 * cards-vs-tabela de F5 (aqui não há duas representações, é a mesma lista
 * reorientada).
 *
 * A rolagem horizontal do desktop mora em `.brk-scroll` (`overflow-x:auto`),
 * nunca no `<body>`: com 5+ rodadas as colunas passam da largura útil, e o
 * padrão do projeto é a página nunca ter overflow horizontal.
 *
 * ### Componentes do DS — o que esta tela consome
 *
 * `ui/MatchCard` e `ui/BracketRoundHeader` foram desenhados para esta tela,
 * mas na primeira passada nenhum encaixou e a tela subiu com markup próprio
 * (`.brk-match`, `.brk-round__label`). Os dois foram adaptados desde então e
 * agora são consumidos aqui — as diferenças viraram props aditivas, e o
 * resultado visual é o mesmo dos frames:
 *
 * - `MatchCard`: `fluid` (largura elástica, no lugar dos 240px do símbolo),
 *   `density="compact"`, `statusPlacement="footer"` + `statusLabel` (o status
 *   dos frames é uma linha abaixo dos participantes, com texto livre do tipo
 *   "Ao vivo · Quadra #7"), `divider={false}`, `winnerStyle="emphasis"` e
 *   `onClick`. Esta última é a mudança que mais importava: o card inteiro é o
 *   botão que abre o Detalhe da Partida, e o componente agora vira o próprio
 *   `<button>` levando junto o `aria-label` de frase montada — antes ele era
 *   um `role="group"` não interativo, e aninhá-lo num `<button>` externo
 *   perderia a frase no nome acessível.
 * - `BracketRoundHeader`: `variant="plain"`, o cabeçalho de texto puro
 *   (Overline em text/muted) que os frames desenham, em vez da pílula de
 *   240px fixos com contagem de jogos.
 *
 * ### `ui/BracketConnector` — avaliado de novo e NÃO usado
 *
 * Não há UMA linha de conector em nenhum dos três frames: as rodadas são
 * colunas de flex separadas só por gap. Diferente dos outros dois, aqui não
 * existe adaptação possível que preserve o desenho — qualquer conector, fixo
 * ou derivado de posição, ACRESCENTARIA traço a uma tela que não tem nenhum.
 * O impedimento é o desenho, não a API do componente.
 *
 * ### Gap consciente
 *
 * A faixa "QUARTAS · SEMI · FINAL" do topo do frame mobile (177:2360) não é
 * renderizada: é decorativa (não navega nem filtra), repete literalmente os
 * cabeçalhos das seções logo abaixo e usaria um segundo vocabulário de
 * rótulos curtos ("SEMI") que o backend não fornece — `roundLabel` deriva um
 * único conjunto de nomes a partir da última rodada.
 */
export default function BracketPage() {
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

  const tournament = tournamentState.status === 'ready' ? tournamentState.tournament : null
  const categories: BracketCategory[] = tournament?.categories ?? []
  const activeCategory = categories.find((c) => c.id === categoryId) ?? null
  const matches = matchesState.status === 'ready' ? matchesState.matches : []
  const registrationCount = new Set(
    matches.flatMap((m) => [m.registration1Id, m.registration2Id].filter((id): id is string => Boolean(id))),
  ).size
  const finishedCount = matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length
  const tournamentHref = tournamentId ? `/tournaments/${tournamentId}` : '#'

  return (
    <>
      <div className="brk-page">
        {/* "‹ Voltar" (frame mobile 177:2346) e breadcrumb (o frame desktop
            não desenha retorno nenhum, mas esta tela fica dois níveis abaixo
            da lista e a sidebar só volta até "Torneios"): os dois estão no
            DOM e quem escolhe é uma @media em BREAKPOINT_SHELL_DESKTOP_MIN,
            mesmo mecanismo de F3. */}
        <div className="pg-head brk-head">
          <Link className="brk-back" to={tournamentHref}>
            ‹ Voltar
          </Link>
          <nav className="brk-crumbs" aria-label="Trilha de navegação">
            <Link className="brk-crumbs__link" to={tournamentHref}>
              Torneio
            </Link>
            <span className="brk-crumbs__sep" aria-hidden="true">
              ›
            </span>
            <span aria-current="page">Chaves{activeCategory ? ` · ${activeCategory.name}` : ''}</span>
          </nav>
        </div>

        <div className="dash-body brk-body">
          <div className="brk-title-block">
            <h1 className="brk-title">{tournament?.name ?? 'Chaves'}</h1>
            {tournament?.status === 'em_andamento' ? (
              <Badge tone="danger">
                <span className="brk-live-dot" aria-hidden="true" />
                AO VIVO
              </Badge>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <div className="brk-cats" role="tablist" aria-label="Categorias do torneio">
              {categories.map((c) => (
                <button
                  type="button"
                  role="tab"
                  key={c.id}
                  aria-selected={c.id === categoryId}
                  className={`brk-cat${c.id === categoryId ? ' brk-cat--active' : ''}`}
                  onClick={() => setCategoryId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}

          {tournamentState.status === 'loading' ? (
            <PageLoading label="Carregando chaves" variant="section" />
          ) : tournamentState.status === 'error' ? (
            <p className="brk-alert" role="alert">
              Não foi possível carregar o torneio.
            </p>
          ) : matchesState.status === 'loading' ? (
            <PageLoading label="Carregando partidas" variant="section" />
          ) : matchesState.status === 'error' ? (
            <p className="brk-alert" role="alert">
              Não foi possível carregar as partidas desta categoria.
            </p>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={<Icon name="bracket" size={40} />}
              title="Chaves serão divulgadas em breve."
              description="Assim que o sorteio for feito, os confrontos aparecem aqui."
            />
          ) : (
            <>
              {activeCategory && BRACKET_FORMATS.has(activeCategory.bracketFormat ?? '') ? (
                <BracketColumnsView matches={matches} onOpen={openMatch} />
              ) : (
                <BracketTableView matches={matches} onOpen={openMatch} />
              )}
              <p className="brk-stats">
                {registrationCount} duplas · {matches.length} jogos · {finishedCount} finalizados
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
