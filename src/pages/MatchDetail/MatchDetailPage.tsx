import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Card } from '../../components/ui/Card/Card'
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

function courtLabel(courtId: string | null): string {
  return courtId ? `Quadra #${courtId.slice(0, 4)}` : 'Quadra a definir'
}

function currentSet(sets: MatchSet[]): MatchSet {
  if (sets.length === 0) return { setNumber: 1, registration1Score: 0, registration2Score: 0 }
  return sets.reduce((latest, s) => (s.setNumber > latest.setNumber ? s : latest))
}

/** Quem está ganhando/ganhou o confronto — só para o realce de placar do
 * hero (o frame põe o número do lado à frente em text/brand). Contagem de
 * sets vencidos, não o placar do set corrente: é assim que se lê um jogo. */
function setsWonBy(match: MatchDetailResponse): { one: number; two: number } {
  let one = 0
  let two = 0
  for (const set of match.sets) {
    if (set.registration1Score > set.registration2Score) one++
    else if (set.registration2Score > set.registration1Score) two++
  }
  return { one, two }
}

/**
 * TO6 — Detalhe da Partida (BEAC-2007, story BEAC-1719).
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
 *
 * ## Reskin design system (Figma "20 · Torneios — Detalhe da Partida",
 * node 177:2415 mobile / 187:6786 desktop)
 *
 * Layout único (coluna) nos dois frames, só mais larga no desktop — padrão de
 * F3, sem o par cards/tabela de F5. Blocos:
 *
 * - Retorno: "‹ Voltar" no mobile (177:2454) trocado por breadcrumb
 *   "Chaves › Partida" a partir de BREAKPOINT_SHELL_DESKTOP_MIN, 100% em CSS.
 * - Título + subtítulo (177:2456): o `<h1>` é a rodada. O subtítulo do frame
 *   ("Copa Verão BT · Masculino A") NÃO é renderizado — `MatchDetailResponse`
 *   não traz nome do torneio nem da categoria, e resolvê-los custaria um
 *   segundo GET /tournaments/{id} que nenhum AC desta tela pede. Mesmo gap
 *   que a versão anterior desta tela já documentava para o badge do topo;
 *   preferimos o campo vazio a inventar o dado.
 * - Score hero (177:2459 / 188:3692): surface/sunken no mobile, card com
 *   borda no desktop; uma linha por dupla com o placar grande, `ui/Badge` de
 *   estado e a linha de quadra. O "👤" do frame é decorativo e entra por
 *   `::before` no CSS — `ui/Avatar` não cabe aqui: o participante é uma DUPLA
 *   ("Marina / Carla"), e as iniciais que o Avatar deriva de um nome
 *   ("MC") descreveriam uma pessoa que não existe.
 * - Card "Sets" (177:2474 / 188:3706): `ui/Card` + `<table>` com cabeçalhos
 *   S1/S2/S3 (a forma escrita por extenso fica no nome acessível).
 * - Nota de estatísticas (177:2491): o texto do frame, que descreve
 *   exatamente o escopo reduzido já acordado (stats avançadas são opcionais
 *   no MVP).
 *
 * ### Não renderizado de propósito
 *
 * As abas "Resumo · Sets · Stats" (177:2470 / 188:3702) ficam de fora: duas
 * das três não têm conteúdo nenhum nesta tela (Resumo é o próprio hero,
 * Stats está fora do MVP por AC) e, nos frames, mobile e desktop marcam abas
 * ATIVAS diferentes mostrando o mesmo card — é decoração do protótipo, não um
 * controle. Renderizá-las criaria dois destinos inertes.
 *
 * ### `ui/MatchCard` — avaliado e NÃO usado
 *
 * O componente do DS foi desenhado com esta tela em mente, mas modela o card
 * COMPACTO da chave: `width: 240px` fixo, header próprio de
 * seed/categoria/status, nome em `--type-body` e placar de 15px por set. O
 * hero destes frames é o oposto — bloco de 640px, nome de 18px e placar de
 * 26px em `--font-display`, com o badge de estado e a quadra abaixo, não
 * dentro de um header. E a grade de sets do frame é uma `<table>` com
 * cabeçalhos S1/S2/S3, enquanto o `MatchCard` põe os sets soltos na linha do
 * participante, sem cabeçalho. Não há prop que aproxime os dois; forçar
 * exigiria reescrever o componente do DS a partir desta tela.
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
  const won = match ? setsWonBy(match) : null
  const bracketHref = tournamentId ? `/tournaments/${tournamentId}/bracket` : '#'

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
      <div className="mtc-page">
        <div className="pg-head mtc-head">
          <Link className="mtc-back" to={bracketHref}>
            ‹ Voltar
          </Link>
          <nav className="mtc-crumbs" aria-label="Trilha de navegação">
            <Link className="mtc-crumbs__link" to={bracketHref}>
              Chaves
            </Link>
            <span className="mtc-crumbs__sep" aria-hidden="true">
              ›
            </span>
            <span aria-current="page">Partida</span>
          </nav>
        </div>

        <div className="dash-body mtc-body">
          <h1 className="mtc-title">{match ? `Rodada ${match.round}` : 'Partida'}</h1>

          {state.status === 'loading' ? (
            <PageLoading label="Carregando partida" variant="section" />
          ) : state.status === 'error' ? (
            <p className="mtc-alert" role="alert">
              Não foi possível carregar a partida.
            </p>
          ) : match && live && won ? (
            <>
              <div className="mtc-hero" data-testid="score-hero">
                <div className="mtc-hero__side">
                  <span className="mtc-hero__duo">{match.registration1Name ?? 'A definir'}</span>
                  <span
                    className={`mtc-hero__score${won.one > won.two ? ' mtc-hero__score--lead' : ''}`}
                  >
                    {live.registration1Score}
                  </span>
                </div>
                <div className="mtc-hero__side">
                  <span className="mtc-hero__duo">{match.registration2Name ?? 'A definir'}</span>
                  <span
                    className={`mtc-hero__score${won.two > won.one ? ' mtc-hero__score--lead' : ''}`}
                  >
                    {live.registration2Score}
                  </span>
                </div>
                <div className="mtc-hero__badge">
                  {isFinal ? (
                    <Badge tone="neutral">FINAL</Badge>
                  ) : (
                    <Badge tone="danger">
                      <span className="mtc-live-dot" aria-hidden="true" />
                      SET {live.setNumber} · AO VIVO
                    </Badge>
                  )}
                </div>
                <p className="mtc-hero__court">{courtLabel(match.courtId)}</p>
              </div>

              <Card>
                <h2 className="mtc-sets__title">Sets</h2>
                <table className="mtc-sets__table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="mtc-sr-only">Dupla</span>
                      </th>
                      {Array.from({ length: SET_COLUMNS }, (_, i) => (
                        <th scope="col" key={i}>
                          <span aria-hidden="true">S{i + 1}</span>
                          <span className="mtc-sr-only">Set {i + 1}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{match.registration1Name ?? 'A definir'}</th>
                      {Array.from({ length: SET_COLUMNS }, (_, i) => {
                        const set = match.sets.find((s) => s.setNumber === i + 1)
                        const winner = set && set.registration1Score > set.registration2Score
                        return (
                          <td key={i} className={winner ? 'w' : undefined}>
                            {set ? set.registration1Score : '—'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <th scope="row">{match.registration2Name ?? 'A definir'}</th>
                      {Array.from({ length: SET_COLUMNS }, (_, i) => {
                        const set = match.sets.find((s) => s.setNumber === i + 1)
                        const winner = set && set.registration2Score > set.registration1Score
                        return (
                          <td key={i} className={winner ? 'w' : undefined}>
                            {set ? set.registration2Score : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </Card>

              <p className="mtc-note">
                Estatísticas detalhadas ficam disponíveis quando o admin registra o jogo com dados
                avançados.
              </p>

              {canRegisterResult ? (
                <Button variant="primary" size="md" fullWidth onClick={() => setSheetOpen(true)}>
                  Registrar resultado (admin)
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
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
