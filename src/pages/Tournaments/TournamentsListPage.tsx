import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { usePermission } from '../../hooks/usePermission'
import {
  listTournaments,
  type TournamentListItem,
  type TournamentListScope,
} from '../../lib/api/tournaments'
import { registrationCountdownLabel } from '../../lib/tournamentCountdown'
import { sportCssVar, sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
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
 * documentado em TurmasListPage.tsx pra ocupação de turma).
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
        <div className="tabs2" role="tablist" aria-label="Filtrar torneios">
          {TABS.map((tab) => (
            <button
              key={tab.scope}
              type="button"
              role="tab"
              aria-selected={scope === tab.scope}
              className={scope === tab.scope ? 'active' : ''}
              onClick={() => setScope(tab.scope)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => unitId && navigate(`/units/${unitId}/tournaments/new`)}
          >
            Criar
          </button>
        ) : null}
      </div>

      <div className="dash-body">
        {!isCurrent ? <p role="status">Carregando torneios…</p> : null}
        {isCurrent && state.status === 'error' ? (
          <p role="alert">Não foi possível carregar os torneios.</p>
        ) : null}

        {isCurrent && state.status === 'ready' ? (
          <>
            {live.length > 0 ? (
              <Section title="Ao vivo" variant="live">
                {live.map((t) => (
                  <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                ))}
              </Section>
            ) : null}

            {open.length > 0 ? (
              <Section title="Inscrições abertas" variant="teal">
                {open.map((t) => (
                  <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                ))}
              </Section>
            ) : null}

            {closed.length > 0 ? (
              <Section title="Encerrados" variant="muted">
                {closed.map((t) => (
                  <TournamentCard key={t.id} tournament={t} onClick={() => goToTournament(t)} />
                ))}
              </Section>
            ) : null}

            {tournaments.length === 0 ? <p className="hint">Nenhum torneio encontrado.</p> : null}
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

function Section({
  title,
  variant,
  children,
}: {
  title: string
  variant: 'live' | 'teal' | 'muted'
  children: ReactNode
}) {
  return (
    <div>
      <div className="sec-head">
        <h2 className={variant}>
          {variant === 'live' ? <span className="live-dot" /> : null}
          {title}
        </h2>
      </div>
      <div className="to-list">{children}</div>
    </div>
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
  const champions = tournament.champions ?? []

  return (
    <button
      type="button"
      className={`to-card${isLive ? ' is-live' : ''}`}
      onClick={onClick}
      data-testid={`tournament-card-${tournament.id}`}
    >
      <span className="strip" style={{ background: `var(${sportCssVar(tournament.sport)})` }} />
      <span className="tm">
        <h3>
          {tournament.name}
          {isDraft ? <Badge tone="neutral">Rascunho</Badge> : null}
        </h3>
        <span className="mt">
          {[
            sportLabel(tournament.sport),
            TYPE_LABEL[tournament.type] ?? tournament.type,
            formatDateRange(tournament.startDate, tournament.endDate),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="tail">
        {champions.length > 0
          ? champions.map((c) => (
              <span key={c.categoryName}>
                🏆 {c.championName} ({c.categoryName})
              </span>
            ))
          : countdown
            ? <span>{countdown}</span>
            : null}
      </span>
    </button>
  )
}
