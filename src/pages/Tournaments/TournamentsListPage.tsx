import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { EventStatusBadge } from '../../components/ui/EventStatusBadge/EventStatusBadge'
import { SportTag } from '../../components/ui/SportTag/SportTag'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { usePermission } from '../../hooks/usePermission'
import {
  listTournaments,
  type TournamentListItem,
  type TournamentListScope,
} from '../../lib/api/tournaments'
import { registrationCountdownLabel } from '../../lib/tournamentCountdown'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TournamentsListPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; scope: TournamentListScope }
  | { status: 'ready'; scope: TournamentListScope; tournaments: TournamentListItem[] }

const TABS: { scope: TournamentListScope; label: string }[] = [
  { scope: 'mine', label: 'Meus' },
  { scope: 'abertos', label: 'Abertos' },
  { scope: 'encerrados', label: 'Encerrados' },
]

const TAB_LABELS = TABS.map((tab) => tab.label)

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

/**
 * TO1 — Lista de Torneios (BEAC-1984, story BEAC-1716): última tela do
 * Épico 8, destravada pela BEAC-2013 (GET /units/{id}/tournaments — o
 * endpoint de listagem não existia quando TO2/TO3 foram construídas, ver
 * comentário de pacote antigo em App.tsx sobre esse bloqueio).
 *
 * ## 3 seções, particionando por status — sem "silenciar" nenhum torneio
 *
 * O AC só nomeia 3 seções (Ao vivo/Inscrições abertas/Encerrados), mas os 4
 * valores de `TournamentStatus` (rascunho/publicado/em_andamento/encerrado)
 * precisam de um destino cada um. `em_andamento` -> Ao vivo, `encerrado` ->
 * Encerrados, e `rascunho`+`publicado` -> Inscrições abertas (partição
 * completa do enum, não um bucket arbitrário). Um rascunho aparece aqui só
 * pra quem tem `torneios:write` na própria unit (scope=mine já filtra isso
 * no backend) — sem essa seção, o próprio Admin que clicou "Salvar
 * rascunho" em TO2 não teria como voltar a ele por esta tela; a badge
 * "Rascunho" no card evita confundir com um torneio de inscrição realmente
 * aberta (que tem countdown).
 *
 * ## Sem arena/categorias/duplas no card — não fabricado
 *
 * `TournamentListItem` (BEAC-2013) não devolve unit/arena nem contagem de
 * categorias/duplas inscritas — o card mostra esporte/tipo/data, nunca um
 * número inventado (mesmo princípio de "gap conhecido, nunca escondido" já
 * documentado em TurmasListPage.tsx pra ocupação de turma). Isso é um gap
 * visível contra o Figma, que desenha "Arena Beira-Mar · 15–16 abr" e
 * "6 categorias · 48 duplas" no card: das quatro informações, só a data
 * existe no contrato.
 *
 * ## Reskin design system (Figma "16 · Torneios — Lista", node 174:2231
 * mobile / 187:6710 desktop / 187:7052 vazio)
 *
 * - `Tabs` substitui o `.tabs2` local (Meus/Abertos/Encerrados) — o frame
 *   mobile desenha exatamente o sublinhado deslizante do componente.
 * - `SportTag` é o pill de esporte no topo do card. O frame pinta o pill em
 *   sand/neutro, mas o DS sistematizou "pill de esporte" com a cor fixa do
 *   esporte (node 27:45) e é ela que carrega, sistematizada, a mesma
 *   informação que a `.strip` colorida do card antigo carregava — a
 *   divergência de cor contra o frame é deliberada, a favor do DS.
 * - `EventStatusBadge status="encerrado"` é o pill "Encerrado" que o frame
 *   desktop mostra no card de torneio encerrado. Os outros quatro status do
 *   componente (convite/inscrito/abertas/lotado) não têm origem no contrato
 *   de listagem: `TournamentListItem` não diz se o chamador está inscrito
 *   nem quantas vagas restam, e "abertas" já é o próprio agrupamento.
 * - `EmptyState` cobre o frame 16b (🏆 "Nenhum torneio no momento").
 * - `EventCard` (DS, node 129:2) foi avaliado e DESCARTADO: ele modela o
 *   feed de eventos da agenda (eyebrow TORNEIO/EXPERIMENTAL/SOCIAL para
 *   desambiguar tipos numa lista mista — redundante numa tela só de
 *   torneios) e não tem slot para as linhas que este card precisa
 *   (countdown "encerra em 5 dias", "🏆 campeão (categoria)"), nem estado
 *   para rascunho ou ao vivo. Encaixá-lo exigiria estender o componente do
 *   DS para uma tela só; o card local (`.trn-card`) compõe SportTag +
 *   Badge/EventStatusBadge sem duplicar nenhum deles.
 *
 * ## Desktop: grid de cards, não tabela
 *
 * O frame desktop (187:6710) troca a coluna única por um grid de cards de
 * 344px — não por uma `<table>`, então esta tela NÃO adota o padrão
 * `TableRow`/`TableHeaderCell` de F5. Um único layout no DOM: as seções
 * viram `display: contents` a partir de BREAKPOINT_SHELL_DESKTOP_MIN e os
 * cards passam a fluir todos no mesmo grid, na mesma ordem (ao vivo ->
 * abertas -> encerrados) em que o frame os desenha. Os títulos de seção
 * ficam só para leitor de tela nesse ponto: o frame não os mostra, mas
 * apagá-los do DOM tiraria o agrupamento de quem navega por headings.
 */
export default function TournamentsListPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canCreate = usePermission('torneios', 'write')

  const [scope, setScope] = useState<TournamentListScope>('mine')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      listTournaments(unitId, scope).then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setState({ status: 'error', scope })
          return
        }
        setState({ status: 'ready', scope, tournaments: result.tournaments })
      })
    },
    [unitId, scope],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  // Uma troca de aba muda `scope` antes do fetch correspondente terminar —
  // sem isso, a seção da aba anterior ficaria visível por um instante com o
  // rótulo da aba nova selecionado (mesmo cuidado de "loadedScope" que
  // `isCurrent` resolve aqui sem precisar de um setState síncrono dentro do
  // efeito, que violaria react-hooks/set-state-in-effect).
  const isCurrent = state.status !== 'loading' && state.scope === scope
  const tournaments = isCurrent && state.status === 'ready' ? state.tournaments : []
  const live = tournaments.filter((t) => t.status === 'em_andamento')
  const open = tournaments.filter((t) => t.status === 'rascunho' || t.status === 'publicado')
  const closed = tournaments.filter((t) => t.status === 'encerrado')

  const activeTabLabel = TABS.find((tab) => tab.scope === scope)?.label ?? TAB_LABELS[0]

  function handleTabChange(label: string) {
    const next = TABS.find((tab) => tab.label === label)
    if (next) setScope(next.scope)
  }

  function goToTournament(t: TournamentListItem) {
    // Achado na review de BEAC-1984: TO3 (/tournaments/:id) assume um
    // torneio real/publicado (link público, taxa, tabs de inscrição) — pra
    // um rascunho isso é enganoso, não uma tela de "continuar editando".
    // TO2 ainda não sabe retomar um rascunho existente por id (é uma
    // limitação conhecida, documentada acima), então isso não devolve o
    // admin ao MESMO rascunho — mas evita o dead-end de ver um torneio
    // "publicado" que nunca foi. Ajustar quando TO2 ganhar load-by-id.
    if (t.status === 'rascunho' && unitId) {
      navigate(`/units/${unitId}/tournaments/new`)
      return
    }
    navigate(`/tournaments/${t.id}`)
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Torneios</h1>
        <div className="spacer" />
        {canCreate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => unitId && navigate(`/units/${unitId}/tournaments/new`)}
          >
            Criar
          </Button>
        ) : null}
      </div>

      {/* `trn-body` (e não o utilitário global `.dash-body--wide`): aquele é
          gatilhado por `:has(table)` e esta tela não tem tabela nenhuma —
          ver src/styles/utilities.css. O grid de cards do frame desktop
          precisa do mesmo tipo de soltura, com outro gatilho. */}
      <div className="dash-body trn-body">
        <Tabs
          tabs={TAB_LABELS}
          value={activeTabLabel}
          onChange={handleTabChange}
          ariaLabel="Filtrar torneios"
        />

        {!isCurrent ? <PageLoading label="Carregando torneios" variant="list" /> : null}
        {isCurrent && state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os torneios.</p>
        ) : null}

        {isCurrent && state.status === 'ready' ? (
          tournaments.length === 0 ? (
            <div className="trn-empty">
              <EmptyState
                icon={<span className="trn-empty__glyph">🏆</span>}
                title="Nenhum torneio no momento"
                description="Volte em breve — novos torneios aparecem aqui assim que abrirem."
              />
            </div>
          ) : (
            <div className="trn-groups">
              {live.length > 0 ? (
                <Section title="Ao vivo" variant="live">
                  {live.map((t) => (
                    <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                  ))}
                </Section>
              ) : null}

              {open.length > 0 ? (
                <Section title="Inscrições abertas" variant="open">
                  {open.map((t) => (
                    <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                  ))}
                </Section>
              ) : null}

              {closed.length > 0 ? (
                <Section title="Encerrados" variant="closed">
                  {closed.map((t) => (
                    <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                  ))}
                </Section>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  )
}

/** Agrupamento por status. O emoji que o frame mobile põe antes do rótulo
 * ("🔴 AO VIVO", "📋 INSCRIÇÕES ABERTAS", "✅ ENCERRADOS RECENTES") vem por
 * `::before` no CSS, e não como nó de texto: é puramente decorativo e, no
 * DOM, só atrapalharia o nome acessível do heading. A caixa alta também é
 * CSS (`text-transform`), então o texto real continua "Ao vivo". */
function Section({
  title,
  variant,
  children,
}: {
  title: string
  variant: 'live' | 'open' | 'closed'
  children: ReactNode
}) {
  return (
    <section className={`trn-group trn-group--${variant}`}>
      <h2 className="trn-group__title">{title}</h2>
      {children}
    </section>
  )
}

function TournamentCard({
  tournament,
  onClick,
}: {
  tournament: TournamentListItem
  onClick: () => void
}) {
  const countdown = registrationCountdownLabel(tournament.registrationClosesAt)
  const isDraft = tournament.status === 'rascunho'
  const isLive = tournament.status === 'em_andamento'
  const isClosed = tournament.status === 'encerrado'
  const champions = tournament.champions ?? []

  return (
    <button
      type="button"
      className={`trn-card${isLive ? ' trn-card--live' : ''}`}
      onClick={onClick}
      data-testid={`tournament-card-${tournament.id}`}
    >
      <span className="trn-card__head">
        <SportTag sport={tournament.sport} />
        {isDraft ? <Badge tone="neutral">Rascunho</Badge> : null}
      </span>
      <span className="trn-card__title">{tournament.name}</span>
      <span className="trn-card__meta">
        {TYPE_LABEL[tournament.type] ?? tournament.type} ·{' '}
        {formatDateRange(tournament.startDate, tournament.endDate)}
      </span>
      {champions.map((c) => (
        <span className="trn-card__champion" key={c.categoryName}>
          🏆 {c.championName} ({c.categoryName})
        </span>
      ))}
      {countdown && !isClosed ? <span className="trn-card__countdown">{countdown}</span> : null}
      {/* "3 jogos ao vivo" do frame precisaria de uma contagem de partidas
          em andamento que a listagem não devolve — o pill fica só com o
          estado, sem número inventado. */}
      {isLive ? (
        <span className="trn-card__status">
          <Badge tone="danger">🔴 Ao vivo</Badge>
        </span>
      ) : null}
      {isClosed ? (
        <span className="trn-card__status">
          <EventStatusBadge status="encerrado" />
        </span>
      ) : null}
    </button>
  )
}
