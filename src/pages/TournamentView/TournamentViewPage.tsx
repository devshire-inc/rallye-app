import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TemporarySessionBanner } from '../../components/TemporarySessionBanner/TemporarySessionBanner'
import { Badge } from '../../components/ui/Badge/Badge'
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
import { sportLabel } from '../../lib/sports'
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
 */
export function TournamentViewPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
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

      {state.status === 'loading' ? <p role="status">Carregando torneio…</p> : null}
      {state.status === 'not-found' ? <p role="alert">Torneio não encontrado.</p> : null}
      {state.status === 'unavailable' ? (
        <p role="alert">Não foi possível carregar os dados deste torneio agora.</p>
      ) : null}

      {tournament ? (
        <>
          <div className="pg-head">
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
              </h1>
              <div className="mt">
                {[
                  sportLabel(tournament.sport),
                  TYPE_LABEL[tournament.type] ?? tournament.type,
                  formatDateRange(tournament.startDate, tournament.endDate),
                  courtsSegment,
                  `taxa ${formatBRL(tournament.entryFee)}/dupla`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          {shareLabel === 'Link copiado!' ? <p role="status">{shareLabel}</p> : null}

          <div className="ptabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'info'}
              className={tab === 'info' ? 'active' : ''}
              onClick={() => setTab('info')}
            >
              Info
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'inscritos'}
              className={tab === 'inscritos' ? 'active' : ''}
              onClick={() => setTab('inscritos')}
            >
              Inscritos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'chaves'}
              className={tab === 'chaves' ? 'active' : ''}
              onClick={() => setTab('chaves')}
            >
              Chaves
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'ranking'}
              className={tab === 'ranking' ? 'active' : ''}
              onClick={() => setTab('ranking')}
            >
              Ranking
            </button>
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
      <div className="stack">
        {tournament.categories.map((category) => {
          const registrations = registrationsByCategory[category.id]
          if (registrations === undefined || registrations === 'unavailable') {
            return (
              <div className="cat-row" key={category.id}>
                <span className="cn">{category.name}</span>
                <span className="cv">—/{category.maxParticipants}</span>
              </div>
            )
          }
          const confirmed = registrations.filter((r) => r.status === 'confirmed').length
          const remaining = category.maxParticipants - confirmed
          const occupancy = remaining <= 0 ? 'lotada' : `${remaining} vaga${remaining === 1 ? '' : 's'}`
          return (
            <div className="cat-row" key={category.id}>
              <span className="cn">{category.name}</span>
              <span className="cv">
                {confirmed}/{category.maxParticipants} · {occupancy}
              </span>
            </div>
          )
        })}
      </div>

      <div className="card">
        <b className="sec-head-title">Regulamento</b>
        <p className="hint">{tournament.rules ?? 'Regulamento não informado.'}</p>
      </div>

      <Link className="btn btn-primary btn-md" to={`/tournaments/${tournamentId}/register`}>
        Inscrever-se
      </Link>
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
              <p className="hint" role="status">
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
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onWithdraw(reg)}
                    >
                      Desistiu
                    </button>
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
        <p className="hint" role="status">
          Chaveamento ainda não foi gerado.
        </p>
      </div>
    )
  }
  return (
    <div className="ptab-panel">
      <Link className="btn btn-primary btn-md" to={`/tournaments/${tournamentId}/bracket`}>
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
