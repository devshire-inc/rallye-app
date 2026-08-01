import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TemporarySessionBanner } from '../../components/TemporarySessionBanner/TemporarySessionBanner'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { EventStatusBadge } from '../../components/ui/EventStatusBadge/EventStatusBadge'
import { SportTag } from '../../components/ui/SportTag/SportTag'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { WithdrawSheet } from '../../components/WithdrawSheet/WithdrawSheet'
import { usePermission } from '../../hooks/usePermission'
import { listCourts } from '../../lib/api/courts'
import { listMembers } from '../../lib/api/members'
import {
  getTournament,
  listCategoryRegistrations,
  type TournamentCategory,
  type TournamentDetail,
  type TournamentRegistration,
} from '../../lib/api/tournamentWithdrawal'
import { formatBRL } from '../../lib/money'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TournamentViewPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'unavailable' }
  | { status: 'ready'; tournament: TournamentDetail }

type Tab = 'info' | 'inscritos' | 'chaves' | 'ranking'

/** 'unavailable' cobre o gap conhecido de BEAC-1991 (visitante/sessão
 * temporária não conseguem ler /tournament-categories/{id}/registrations) —
 * a aba correspondente mostra um aviso explícito em vez de travar a tela. */
type RegistrationsByCategory = Record<string, TournamentRegistration[] | 'unavailable'>

const TYPE_LABEL: Record<string, string> = {
  fechado: 'fechado',
  aberto: 'aberto',
  inter_arenas: 'inter-arenas',
  externo: 'externo',
}

const MONTH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const TAB_LABELS: Record<Tab, string> = {
  info: 'Info',
  inscritos: 'Inscritos',
  chaves: 'Chaves',
  ranking: 'Ranking',
}

const TAB_ORDER: Tab[] = ['info', 'inscritos', 'chaves', 'ranking']

function formatDateRange(startIso: string, endIso: string): string {
  const [, sm, sd] = startIso.slice(0, 10).split('-').map(Number)
  const [, em, ed] = endIso.slice(0, 10).split('-').map(Number)
  if (sm === em) return `${sd}–${ed} ${MONTH[sm - 1]}`
  return `${sd} ${MONTH[sm - 1]}–${ed} ${MONTH[em - 1]}`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

function bracketGenerated(status: TournamentDetail['status']): boolean {
  return status === 'em_andamento' || status === 'encerrado'
}

/**
 * TO3 — Detalhe do Torneio (BEAC-1993, story BEAC-1718): hub com 4 abas
 * (Info/Inscritos/Chaves/Ranking) construído sobre o stub anterior desta
 * mesma rota (BEAC-1821/1822, A5) — `useParams`/`TemporarySessionBanner`
 * preservados tal como estavam, é exatamente o mecanismo de "visitante
 * acessa sem conta, view-only" que este AC pede.
 *
 * ## Leituras visitor-safe e o gap de BEAC-1991
 *
 * getTournament/listCategoryRegistrations (../../lib/api/tournamentWithdrawal)
 * não lançam pra HTTP não-ok — ambas voltam `ok:false`, tratado aqui como
 * estado gracioso ("torneio indisponível agora" / "dados de inscritos
 * indisponíveis agora"), nunca uma tela quebrada. Isso cobre tanto um erro
 * de infra real quanto o gap conhecido e aceito de acesso verdadeiramente
 * anônimo (ver comentário de pacote em tournamentWithdrawal.ts) — a UI não
 * distingue os dois casos, ambos recebem o mesmo tratamento gracioso.
 *
 * ## Nomes de jogador — melhor esforço, nunca fabricado
 *
 * O contrato de GET /tournament-categories/{id}/registrations só devolve
 * player1_id/player2_id (UUIDs) — sem nome de exibição. Não existe endpoint
 * dedicado "nome por id" nesta story; em vez de pedir uma mudança de
 * contrato de backend só pra isso, a tela reaproveita GET /units/{id}/members
 * (já existe, BEAC-1844) como melhor esforço pra resolver id -> nome. Esse
 * endpoint exige `config:write` (bem mais restrito que `torneios:write`) — a
 * matriz de permissões default do Épico 3 dá as duas ao mesmo role Admin, o
 * que cobre o caso mais importante (o próprio Admin decidindo uma
 * desistência), mas um role customizado com só `torneios:write` veria os
 * jogadores pelo fallback `Jogador #xxxx` em vez do nome — degradação
 * aceitável (nunca quebra a tela, nunca inventa um nome), documentada aqui
 * em vez de escondida.
 *
 * ## `?notifications=1` — integração existente com VisitorVerifyPage (A5)
 *
 * Restaurado na correção nº1 (achado do reviewer): `VisitorVerifyPage.tsx`
 * (BEAC-1821/1822) navega pra cá com esse query param depois que a sessão
 * temporária de visitante é verificada, esperando uma confirmação visível
 * nesta tela — não é um detalhe do stub anterior que podia ser descartado ao
 * reescrever TO3, é uma integração de outra story que dependia deste
 * comportamento.
 *
 * ## Reskin design system (Figma "17 · Torneios — Detalhe", node 174:2319
 * mobile / 187:6729 desktop)
 *
 * - `Tabs` substitui o `.ptabs` local (Info/Inscritos/Chaves/Ranking).
 * - `SportTag` é o marcador do esporte na primeira linha de metadados — o
 *   "🟠" que o frame desenha antes de "Beach Tennis" é exatamente o dot
 *   colorido desse componente.
 * - `EventStatusBadge` cobre os dois status que o frame nomeia no cabeçalho
 *   ("Inscrições abertas" / "Encerrado"). `em_andamento` continua com o
 *   `Badge tone="danger"` + `.live-dot`: "AO VIVO" não é um dos 5 status do
 *   componente (convite/inscrito/abertas/lotado/encerrado) e forçá-lo em
 *   `encerrado` seria mentira semântica.
 * - `Button` (ghost/sm) no "Desistiu" da aba Inscritos, no lugar do
 *   `.btn.btn-ghost` local.
 * - `EventCard`/`Card`/`ListRow` do DS foram avaliados e DESCARTADOS aqui:
 *   `EventCard` é o card de uma LISTA de eventos (esta tela é o detalhe de
 *   um só); `Card` renderiza `<button>` quando interativo e `<div>` sem
 *   semântica de seção quando não — os blocos "Categorias"/"Regulamento" do
 *   frame são seções com heading próprio, então `.tv-card` usa `<h2>` de
 *   verdade; e `ListRow` (mesmo motivo já registrado em telas anteriores
 *   desta leva) modela linha de menu com chevron/ação à direita, não a
 *   linha "• Categoria (x/y)" com marcador do frame.
 *
 * ## Desktop: mesma coluna, mais larga — sem tabela
 *
 * O frame desktop (187:6729) é o MESMO layout do mobile numa coluna de
 * 780px, com tipografia maior; não há `<table>` em lugar nenhum, então esta
 * tela segue o padrão de F3InvoiceDetailPage (layout único, só o "‹ Voltar"
 * some no desktop) e NÃO o de F5 (dois layouts + TableRow).
 */
export function TournamentViewPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const notificationsEnabled = searchParams.get('notifications') === '1'
  const canManage = usePermission('torneios', 'write')

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('info')
  const [registrationsByCategory, setRegistrationsByCategory] = useState<RegistrationsByCategory>({})
  const [membersById, setMembersById] = useState<Record<string, string>>({})
  const [courtNames, setCourtNames] = useState<string[] | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<TournamentRegistration | null>(null)
  const [shareLabel, setShareLabel] = useState('Compartilhar link público')

  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    getTournament(tournamentId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: result.status === 404 ? 'not-found' : 'unavailable' })
        return
      }
      setState({ status: 'ready', tournament: result.tournament })
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const tournament = state.status === 'ready' ? state.tournament : null

  const loadRegistrations = useCallback((categories: TournamentCategory[], onCancelled: () => boolean) => {
    Promise.all(
      categories.map((category) =>
        listCategoryRegistrations(category.id).then((result) => ({ categoryId: category.id, result })),
      ),
    ).then((results) => {
      if (onCancelled()) return
      const next: RegistrationsByCategory = {}
      for (const { categoryId, result } of results) {
        next[categoryId] = result.ok
          ? result.registrations.filter((r) => r.status !== 'withdrawn')
          : 'unavailable'
      }
      setRegistrationsByCategory(next)
    })
  }, [])

  useEffect(() => {
    if (!tournament) return
    let cancelled = false
    loadRegistrations(tournament.categories, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [tournament, loadRegistrations])

  useEffect(() => {
    if (!tournament) return
    let cancelled = false
    listMembers(tournament.unitId).then((result) => {
      if (cancelled || !result.ok) return
      const map: Record<string, string> = {}
      for (const member of result.members) map[member.user.id] = member.user.name
      setMembersById(map)
    })
    return () => {
      cancelled = true
    }
  }, [tournament])

  useEffect(() => {
    if (!tournament) return
    let cancelled = false
    listCourts(tournament.unitId).then((result) => {
      if (cancelled || !result.ok) return
      const byId = new Map(result.courts.map((c) => [c.id, c.name]))
      const names = tournament.courtIds.map((id) => byId.get(id)).filter((n): n is string => !!n)
      if (names.length > 0) setCourtNames(names)
    })
    return () => {
      cancelled = true
    }
  }, [tournament])

  function playerLabel(id: string, manualName: string | null): string {
    return membersById[id] ?? manualName ?? `Jogador #${id.slice(0, 4)}`
  }

  function pairLabel(reg: TournamentRegistration): string {
    const p1 = playerLabel(reg.player1Id, null)
    if (!reg.player2Id && !reg.player2ManualName) return p1
    const p2 = reg.player2Id ? playerLabel(reg.player2Id, reg.player2ManualName) : reg.player2ManualName
    return `${p1} / ${p2}`
  }

  function handleShare() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setShareLabel('Link copiado!')
      setTimeout(() => setShareLabel('Compartilhar link público'), 2000)
    })
  }

  function handleWithdrawn() {
    setWithdrawTarget(null)
    if (tournament) loadRegistrations(tournament.categories, () => false)
  }

  const courtsSegment = courtNames
    ? joinNames(courtNames)
    : tournament && tournament.courtIds.length > 0
      ? `${tournament.courtIds.length} quadra${tournament.courtIds.length === 1 ? '' : 's'}`
      : null

  return (
    <section className="tournament-view-page">
      <TemporarySessionBanner tournamentId={tournamentId} />
      {notificationsEnabled ? (
        <p role="status">Notificações ativadas para este torneio.</p>
      ) : null}

      {state.status === 'loading' ? <PageLoading label="Carregando torneio" variant="section" /> : null}
      {state.status === 'not-found' ? <p role="alert">Torneio não encontrado.</p> : null}
      {state.status === 'unavailable' ? (
        <p role="alert">Não foi possível carregar os dados deste torneio agora.</p>
      ) : null}

      {tournament ? (
        <>
          <div className="pg-head">
            {/* "‹ Voltar" existe só no frame mobile (174:2358); o desktop
                (187:6729) não desenha nenhum retorno — some por CSS em
                BREAKPOINT_SHELL_DESKTOP_MIN, onde a sidebar já dá a
                navegação. `navigate(-1)` e não uma rota fixa: esta tela é
                unit-agnóstica e alcançável por TO1, por link público e pelo
                fluxo de visitante (VisitorVerifyPage), que têm origens
                diferentes. */}
            <button type="button" className="tv-back" onClick={() => navigate(-1)}>
              ‹ Voltar
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="iconbtn"
              aria-label="Compartilhar link público"
              onClick={handleShare}
            >
              🔗
            </button>
          </div>

          {/* Faixa do topo (174:2359 / 187:6950): bloco em surface/sunken com
              o troféu e o nome. Puramente decorativa — o nome de verdade é o
              `<h1>` logo abaixo, então o troféu é aria-hidden e o texto,
              redundante para leitor de tela, sai do fluxo acessível. */}
          <div className="tv-banner" aria-hidden="true">
            <span className="tv-banner__glyph">🏆</span>
            <span className="tv-banner__name">{tournament.name}</span>
          </div>

          <div className="prof-head">
            <div className="ph-main">
              <h1>
                {tournament.name}
                {tournament.status === 'em_andamento' ? (
                  <Badge tone="danger">
                    <span className="live-dot" />
                    AO VIVO
                  </Badge>
                ) : null}
                {tournament.status === 'publicado' ? <EventStatusBadge status="abertas" /> : null}
                {tournament.status === 'encerrado' ? <EventStatusBadge status="encerrado" /> : null}
              </h1>
              {/* Bloco de metadados do frame: uma linha por informação, cada
                  uma com o seu marcador. Os emojis vêm de `::before` no CSS
                  (decorativos, fora do nome acessível de cada item) exceto o
                  do esporte, que é o dot colorido do `SportTag` do DS — o
                  "🟠" do frame é literalmente essa bolinha de esporte.
                  A linha "🏟️ Arena Beira-Mar" do Figma NÃO é renderizada:
                  `TournamentDetail` (tournamentWithdrawal.ts) só devolve
                  `unitId`, e esta tela é lida por visitante sem sessão — não
                  há leitura de unit disponível aqui pra resolver o nome da
                  arena, e inventá-lo estaria fora de questão. */}
              <ul className="tv-meta">
                <li className="tv-meta__item tv-meta__item--sport">
                  <SportTag sport={tournament.sport} />
                  <span>{TYPE_LABEL[tournament.type] ?? tournament.type}</span>
                </li>
                <li className="tv-meta__item tv-meta__item--dates">
                  {formatDateRange(tournament.startDate, tournament.endDate)}
                </li>
                {courtsSegment ? (
                  <li className="tv-meta__item tv-meta__item--courts">{courtsSegment}</li>
                ) : null}
                <li className="tv-meta__item tv-meta__item--fee">
                  {formatBRL(tournament.entryFee)} / dupla
                </li>
              </ul>
            </div>
          </div>

          {shareLabel === 'Link copiado!' ? <p role="status">{shareLabel}</p> : null}

          <div className="tv-tabs">
            <Tabs
              tabs={TAB_ORDER.map((key) => TAB_LABELS[key])}
              value={TAB_LABELS[tab]}
              onChange={(label) => {
                const next = TAB_ORDER.find((key) => TAB_LABELS[key] === label)
                if (next) setTab(next)
              }}
              ariaLabel="Seções do torneio"
            />
          </div>

          <div className="dash-body">
            {tab === 'info' ? (
              <InfoTab
                tournament={tournament}
                registrationsByCategory={registrationsByCategory}
                tournamentId={tournamentId ?? tournament.id}
              />
            ) : null}
            {tab === 'inscritos' ? (
              <InscritosTab
                categories={tournament.categories}
                registrationsByCategory={registrationsByCategory}
                canManage={canManage}
                pairLabel={pairLabel}
                onWithdraw={setWithdrawTarget}
              />
            ) : null}
            {tab === 'chaves' ? (
              <ChavesTab tournamentId={tournamentId ?? tournament.id} status={tournament.status} />
            ) : null}
            {tab === 'ranking' ? <RankingTab /> : null}
          </div>
        </>
      ) : null}

      <WithdrawSheet
        open={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        registrationId={withdrawTarget?.id ?? ''}
        pairLabel={withdrawTarget ? pairLabel(withdrawTarget) : ''}
        categoryName={
          withdrawTarget
            ? (tournament?.categories.find((c) => c.id === withdrawTarget.categoryId)?.name ?? '')
            : ''
        }
        totalAmount={tournament?.entryFee ?? 0}
        onWithdrawn={handleWithdrawn}
      />
    </section>
  )
}

function InfoTab({
  tournament,
  registrationsByCategory,
  tournamentId,
}: {
  tournament: TournamentDetail
  registrationsByCategory: RegistrationsByCategory
  tournamentId: string
}) {
  return (
    <div className="ptab-panel">
      {/* Frame 174:2381 / 187:6964: as categorias deixam de ser cards soltos e
          passam a ser uma lista com marcador dentro de UM card "Categorias".
          O chip "Sugerida p/ você" do Figma não é renderizado: a sugestão de
          categoria vem de GET /tournaments/{id}/suggested-category
          (tournamentEnrollment.ts, BEAC-1990), que é uma leitura autenticada
          do próprio jogador — esta tela é lida também por visitante sem
          sessão, e a sugestão já aparece em TO4, onde ela muda a escolha. */}
      <div className="tv-card">
        <h2 className="tv-card__title">Categorias</h2>
        <ul className="tv-cats">
          {tournament.categories.map((category) => {
            const registrations = registrationsByCategory[category.id]
            if (registrations === undefined || registrations === 'unavailable') {
              return (
                <li className="tv-cats__row" key={category.id}>
                  <span className="tv-cats__name">{category.name}</span>
                  <span className="tv-cats__value">—/{category.maxParticipants}</span>
                </li>
              )
            }
            const confirmed = registrations.filter((r) => r.status === 'confirmed').length
            const remaining = category.maxParticipants - confirmed
            const occupancy =
              remaining <= 0 ? 'lotada' : `${remaining} vaga${remaining === 1 ? '' : 's'}`
            return (
              <li className="tv-cats__row" key={category.id}>
                <span className="tv-cats__name">{category.name}</span>
                <span className="tv-cats__value">
                  {confirmed}/{category.maxParticipants} · {occupancy}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="tv-card">
        <h2 className="tv-card__title">Regulamento</h2>
        <p className="tv-card__text">{tournament.rules ?? 'Regulamento não informado.'}</p>
      </div>

      {/* `ui/Button` renderiza sempre um `<button>`; o destino aqui é uma
          rota, e trocar o `<Link>` por um botão com `navigate()` tiraria o
          menu de contexto/abrir-em-nova-aba de um link legítimo. Fica o
          `<Link>` estilizado com a mesma anatomia do Button Primary/Large do
          Figma (289:6194) — mesmo precedente já usado na aba Chaves. */}
      <Link className="tv-cta" to={`/tournaments/${tournamentId}/register`}>
        Inscrever-se
      </Link>
      <p className="tv-footnote">Já inscrito? Acompanhe pela aba Chaves.</p>
    </div>
  )
}

function InscritosTab({
  categories,
  registrationsByCategory,
  canManage,
  pairLabel,
  onWithdraw,
}: {
  categories: TournamentCategory[]
  registrationsByCategory: RegistrationsByCategory
  canManage: boolean
  pairLabel: (reg: TournamentRegistration) => string
  onWithdraw: (reg: TournamentRegistration) => void
}) {
  return (
    <div className="ptab-panel">
      {categories.map((category) => {
        const registrations = registrationsByCategory[category.id]
        if (registrations === undefined) return null
        if (registrations === 'unavailable') {
          return (
            <div key={category.id}>
              <div className="dgroup">{category.name}</div>
              <p className="tv-card__text" role="status">
                Dados de inscritos indisponíveis agora.
              </p>
            </div>
          )
        }
        return (
          <div key={category.id}>
            <div className="dgroup">
              {category.name} · {registrations.length} dupla{registrations.length === 1 ? '' : 's'}
            </div>
            <div className="ag-list">
              {registrations.map((reg) => (
                <div className="cat-row" key={reg.id}>
                  <span className="cn">{pairLabel(reg)}</span>
                  <Badge tone={reg.status === 'confirmed' ? 'success' : 'warning'}>
                    {reg.status === 'confirmed' ? 'Confirmada' : 'Pagamento pendente'}
                  </Badge>
                  {canManage && reg.status === 'confirmed' ? (
                    <Button variant="ghost" size="sm" onClick={() => onWithdraw(reg)}>
                      Desistiu
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChavesTab({ tournamentId, status }: { tournamentId: string; status: TournamentDetail['status'] }) {
  if (!bracketGenerated(status)) {
    return (
      <div className="ptab-panel">
        <p className="tv-card__text" role="status">
          Chaveamento ainda não foi gerado.
        </p>
      </div>
    )
  }
  return (
    <div className="ptab-panel">
      <Link className="tv-cta" to={`/tournaments/${tournamentId}/bracket`}>
        Ver chaves
      </Link>
    </div>
  )
}

function RankingTab() {
  return (
    <div className="ptab-panel">
      <div className="toast toast-neutral" role="status">
        O ranking do torneio aparece aqui após o encerramento — veja o ranking geral em <b>TO8</b>.
      </div>
    </div>
  )
}
