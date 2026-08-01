import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Card } from '../../components/ui/Card/Card'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { useMe } from '../../hooks/useMe'
import { getRankings, type RankingEntry, type RankingScope } from '../../lib/api/rankings'
import { getActiveUnitId } from '../../lib/tenantContext'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './RankingsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rankings: RankingEntry[] }

const TOP_LIST_SIZE = 50

/** Medalha das três primeiras posições (Figma 175:2399/175:2408/175:2417).
 * Decorativa: quem carrega a posição para leitor de tela é o `sr-only`
 * "1º lugar" ao lado, porque "🥇" sozinho é lido de forma inconsistente. */
const PLACE_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const SCOPE_TABS: { key: RankingScope; label: string }[] = [
  { key: 'arena', label: 'Arena' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
  { key: 'nacional', label: 'Nacional' },
]

/**
 * TO8 — Rankings (BEAC-2009, story BEAC-1719). Consome GET /rankings (Épico 4,
 * BEAC-1855) sem nenhum endpoint novo — ver ../../lib/api/rankings.ts.
 *
 * Reduções deliberadas de escopo em relação ao protótipo/AC, todas por
 * limitação do backend hoje (não é um bug desta tela, é o que o contrato
 * atual permite):
 * - Sem filtro de esporte: GET /rankings agrega total_points sem nenhuma
 *   dimensão de esporte (tournament_ranking_points não guarda isso) — a
 *   fileira de pílulas 🟠 Beach Tennis / Padel / Futevôlei do frame
 *   (175:2390 / 188:3734) não teria o que filtrar, então não existe aqui.
 * - Sem seta de tendência (↑2/↓1/—) e sem "N torneios": a resposta é
 *   `{student_id, name, total_points}` e nada mais — não há posição anterior
 *   nem contagem de torneios para mostrar. Como as duas informações formam
 *   junta a segunda linha de cada linha do frame (175:2403), essa linha
 *   inteira não é renderizada; ficaria vazia.
 * - Abas "Cidade"/"Estado" ficam desabilitadas (mesmo padrão de item de
 *   menu "inerte" já usado em AppShell para o que ainda não tem rota):
 *   apesar do backend aceitar ?scope=cidade|estado&city=|state=, não existe
 *   hoje nenhum endpoint que devolva o city/state da própria arena do
 *   usuário logado pra preencher esse parâmetro sem pedir uma digitação
 *   manual que o protótipo não desenha.
 *
 * ## Reskin design system (Figma "21 · Rankings", node 175:2340 mobile /
 * 187:6805 desktop)
 *
 * **O desktop NÃO vira tabela** — ao contrário de F5 (Minhas Faturas), o
 * frame 187:6805 mostra exatamente a mesma lista do mobile, só num card de
 * 1080px de largura: nenhum `<table>`, nenhum cabeçalho de coluna, nenhuma
 * coluna de ação. Então esta tela tem UM layout só, e o desktop apenas solta
 * a largura da coluna (ver `.rnk-page .dash-body` em RankingsPage.css) — nada
 * de `ui/TableRow`/`ui/TableHeaderCell` nem de `.dash-body--wide` (que aliás
 * é gatilhado por `:has(table)` e não casaria aqui).
 *
 * **O pódio saiu.** A versão anterior desta tela desenhava um pódio de 3
 * degraus para o top 3 e uma lista numerada a partir do 4º. Nenhum dos dois
 * frames tem pódio: os três primeiros são as três primeiras LINHAS da mesma
 * lista, com medalha no lugar do número. A lista agora é uma só, contínua do
 * 1º ao 50º.
 *
 * ### Componentes de gamificação — avaliados, só um encaixa
 *
 * - `ui/Medal`: NÃO usado, apesar de ser o candidato óbvio. O componente
 *   desenha um círculo com a ABREVIAÇÃO do tier ("B"/"P"/"O"/"Pt"/"D") e a
 *   sua documentação (Medal.tsx) define o eixo dele explicitamente como
 *   frequência/constância — "a medalha reconhece constância, não desempenho"
 *   — expondo `aria-label="Medalha Ouro"`. Aqui o que a coluna comunica é
 *   POSIÇÃO ("1º lugar"), e não existe prop para trocar a letra nem o rótulo:
 *   uma bolinha com "O" ao lado do nome do primeiro colocado não diz nada. O
 *   frame usa 🥇🥈🥉, que é o que esta tela renderiza (decorativo, com o
 *   ordinal em `sr-only`). Uma variante `Medal` com `place`/sem letra
 *   resolveria — é o gap concreto a levar para o DS.
 * - `ui/TierChip` e `ui/LevelProgress`: nenhum dos frames mostra nível
 *   competitivo nem barra de progresso, e `GET /rankings` também não devolve
 *   tier — não há dado nem lugar para eles nesta tela.
 * - `ui/Badge` (tone="brand") é o selo "👤 Você" da própria linha (175:2457);
 *   `ui/Card` é o contêiner branco da lista (175:2397 / 188:3741);
 *   `ui/EmptyState` cobre o ranking vazio, que nenhum frame desenha.
 *
 * As pílulas de escopo continuam com markup local (`role="tablist"`) em vez
 * de `ui/Tabs`: o frame desenha pílulas, não o sublinhado do componente, e
 * `Tabs` não tem como expressar as abas Cidade/Estado desabilitadas.
 */
export default function RankingsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const [scope, setScope] = useState<RankingScope>('arena')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Compartilha o `GET /me` do useShellIdentity acima — ver hooks/useMe.ts.
  const { me } = useMe()
  const myId = me?.id ?? null

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
  const top = rankings.slice(0, TOP_LIST_SIZE)
  const meIndex = myId ? rankings.findIndex((r) => r.studentId === myId) : -1
  const meOutsideList = meIndex >= TOP_LIST_SIZE

  function rankingRow(entry: RankingEntry, position: number) {
    const isMe = entry.studentId === myId
    const medal = PLACE_MEDAL[position]
    return (
      <li
        className={`rnk-row${isMe ? ' rnk-row--me' : ''}`}
        key={entry.studentId}
        data-testid={`ranking-row-${entry.studentId}`}
      >
        <span className="rnk-row__place">
          {medal ? (
            <>
              <span aria-hidden="true">{medal}</span>
              <span className="rnk-sr-only">{position}º lugar</span>
            </>
          ) : (
            position
          )}
        </span>
        <span className="rnk-row__name">
          <span className="rnk-row__label">{entry.name}</span>
          {isMe ? <Badge tone="brand">👤 Você</Badge> : null}
        </span>
        <span className="rnk-row__points">{entry.totalPoints.toLocaleString('pt-BR')} pts</span>
      </li>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="rnk-page">
        <div className="pg-head rnk-head">
          <h1 className="rnk-title">Rankings</h1>
        </div>

        <div className="dash-body rnk-body">
          <div className="rnk-scopes" role="tablist" aria-label="Abrangência do ranking">
            {SCOPE_TABS.map(({ key, label }) => {
              const disabled = key === 'cidade' || key === 'estado'
              return (
                <button
                  type="button"
                  role="tab"
                  key={key}
                  aria-selected={scope === key}
                  className={`rnk-scope${scope === key ? ' rnk-scope--active' : ''}`}
                  disabled={disabled}
                  title={
                    disabled
                      ? 'Em breve — ainda não é possível resolver a cidade/estado da sua arena.'
                      : undefined
                  }
                  onClick={() => setScope(key)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {state.status === 'loading' ? (
            <PageLoading label="Carregando ranking" variant="list" />
          ) : state.status === 'error' ? (
            <p className="rnk-alert" role="alert">
              Não foi possível carregar o ranking.
            </p>
          ) : rankings.length === 0 ? (
            <EmptyState
              icon={<Icon name="ranking" size={40} />}
              title="Ranking ainda vazio"
              description="As pontuações aparecem aqui assim que os primeiros torneios forem encerrados."
            />
          ) : (
            <>
              <Card padding={0}>
                <ol className="rnk-list" data-testid="ranking-list">
                  {top.map((entry, i) => rankingRow(entry, i + 1))}
                  {/* Quem está fora do top 50 continua vendo a própria linha,
                      anexada ao fim com a posição real. */}
                  {meOutsideList && meIndex >= 0
                    ? rankingRow(rankings[meIndex]!, meIndex + 1)
                    : null}
                </ol>
              </Card>

              <p className="rnk-note">
                {rankings.length} {rankings.length === 1 ? 'jogador' : 'jogadores'} no ranking
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
