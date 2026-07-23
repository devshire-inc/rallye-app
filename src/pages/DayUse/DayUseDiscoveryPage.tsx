import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { discoverDayUse, todayIsoDate, type ArenaSummary } from '../../lib/api/dayUseFlow'
import { formatBRL } from '../../lib/money'
import { SPORTS, sportCssVar, sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import './DayUseDiscoveryPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; arenas: ArenaSummary[] }

/** Caminho de DU3 (Confirmar e Pagar) — BEAC-1962/BEAC-1958, agora
 * registrado em App.tsx. Repassa `date` via router state: DU3 usa esse
 * valor como a data da reserva (ver comentário de pacote em
 * DayUseConfirmPage.tsx). */
function du3Path(unitId: string): string {
  return `/day-use/${unitId}/confirm`
}

/**
 * DU1 — Discovery Day Use (BEAC-1960, story BEAC-1928 — "Fluxo de reserva de
 * Day Use para usuário"). Markup/copy lidos diretamente da doc real (Allye,
 * UX e Telas > Financeiro > DU1 — Discovery Day Use): header com date picker
 * (default "Hoje"), busca por nome/cidade, pills de esporte (Todos + BT/
 * Padel/FV/Vôlei), lista de cards de arena (foto, nome, endereço, esportes +
 * preço, RESERVAR/LOTADO).
 *
 * Consome GET /day-use/discover (BEAC-1956) — cross-tenant, sem permission
 * dedicada (qualquer sessão válida vê qualquer arena com Day Use disponível
 * na data pedida, de qualquer tenant).
 *
 * ## Divergências deliberadas da doc (documentadas, não inventadas)
 *
 * - **Date picker**: a doc descreve um "pill" com dropdown ("Hoje, 24 Mar
 *   ▼"). Implementado como `<input type="date">` nativo, default "hoje" —
 *   mesmo espírito de simplificação já aplicado em DayUseConfigPage.tsx
 *   ("Horário liberado — 2 inputs, não 1"): um dropdown de calendário custom
 *   não é um requisito funcional do AC, só um detalhe visual do protótipo.
 * - **Distância/rating/foto**: a doc mostra "⭐4.8 · 2.3km" e fotos reais por
 *   card. O backend (BEAC-1956) não expõe nenhum dos dois — não existe
 *   coluna de foto/rating/lat-long em public.units/courts (ver comentário de
 *   pacote em rallye-api/api/internal/dayuse/discover.go e detail.go). Cada
 *   card mostra um placeholder de ícone por esporte (dot colorido, mesmo
 *   padrão de sportCssVar já usado em TeachersListPage/DayUseConfigPage) no
 *   lugar da foto, e omite rating/distância — não fabrica um número falso.
 * - **Cores "coral"/"aqua"** da doc: esta base nunca implementou esses tokens
 *   (ver src/index.css) — toda tela já construída (DayUseConfigPage,
 *   TeachersListPage etc.) resolve preço/CTA em destaque com `--teal`, o
 *   token de ênfase real do design system implementado. Mesma escolha aqui.
 * - **Ordenação por distância**: a doc pede "mais perto primeiro" via
 *   geolocalização do device. Sem coordenadas de arena no backend, isso não
 *   é implementável ainda — a lista vem do backend já ordenada (disponíveis
 *   antes de lotados, depois por nome; ver comentário de pacote em
 *   discover.go), e o frontend não reordena.
 */
export default function DayUseDiscoveryPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [date, setDate] = useState(todayIsoDate)
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('') // '' = "Todos"

  const load = useCallback(
    (onCancelled: () => boolean) => {
      discoverDayUse({ date, search: search.trim() || undefined, sport: sport || undefined })
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', arenas: result.arenas })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [date, search, sport],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const arenas = state.status === 'ready' ? state.arenas : []

  return (
    <AppShell orgLabel="Rallye" userLabel="Usuário">
      <div className="pg-head">
        <span className="back" style={{ opacity: 0.55 }}>
          ‹ Day Use
        </span>
        <div className="spacer" />
        <input
          type="date"
          className="input du-date-pill"
          aria-label="Data"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="dash-body">
        <div className="searchbar">
          <input
            type="text"
            placeholder="Buscar arena na sua cidade"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar arena por nome ou cidade"
          />
        </div>

        <div className="tabs2" role="group" aria-label="Filtrar por esporte">
          <button
            type="button"
            className={sport === '' ? 'active' : ''}
            aria-pressed={sport === ''}
            onClick={() => setSport('')}
          >
            Todos
          </button>
          {SPORTS.map((s) => (
            <button
              key={s.slug}
              type="button"
              className={sport === s.slug ? 'active' : ''}
              aria-pressed={sport === s.slug}
              onClick={() => setSport(s.slug)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {state.status === 'loading' ? <p role="status">Carregando arenas…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar as arenas com Day Use.</p>
        ) : null}

        {state.status === 'ready' && arenas.length === 0 ? (
          <p className="hint">Nenhuma arena com Day Use na sua região.</p>
        ) : null}

        {state.status === 'ready' && arenas.length > 0 ? (
          <div className="du-arena-list">
            {arenas.map((arena) => (
              <ArenaCard
                key={arena.unitId}
                arena={arena}
                onOpenDetail={() => navigate(`/day-use/${arena.unitId}`)}
                onReserve={() => navigate(du3Path(arena.unitId), { state: { date } })}
              />
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

interface ArenaCardProps {
  arena: ArenaSummary
  onOpenDetail: () => void
  onReserve: () => void
}

function ArenaCard({ arena, onOpenDetail, onReserve }: ArenaCardProps) {
  return (
    <div
      className={`card du-arena-card${arena.lotado ? ' du-arena-lotada' : ''}`}
      data-testid={`arena-card-${arena.unitId}`}
    >
      <button type="button" className="du-arena-main" onClick={onOpenDetail}>
        <span className="du-arena-photo" aria-hidden="true">
          {arena.sports[0] ? (
            <span className="sdot" style={{ background: `var(${sportCssVar(arena.sports[0])})` }} />
          ) : null}
        </span>
        <div className="du-arena-info">
          <b>{arena.name}</b>
          <div className="du-arena-address">{arena.address}</div>
          <div className="du-arena-sports">
            {arena.sports.map((s) => (
              <span key={s} className="sdot" style={{ background: `var(${sportCssVar(s)})` }} />
            ))}
            {arena.sports.map((s) => sportLabel(s)).join(', ')}
          </div>
        </div>
      </button>
      <div className="du-arena-tail">
        {arena.lotado ? (
          <span className="hint">LOTADO</span>
        ) : (
          <>
            <span className="du-arena-price">{formatBRL(arena.price)}</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onReserve}
              data-testid={`reservar-${arena.unitId}`}
            >
              RESERVAR
            </button>
          </>
        )}
      </div>
    </div>
  )
}
