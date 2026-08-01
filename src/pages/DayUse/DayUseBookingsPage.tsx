import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Badge } from '../../components/ui/Badge/Badge'
import { Segmented } from '../../components/ui/Segmented/Segmented'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { usePermission } from '../../hooks/usePermission'
import {
  listDayUseBookings,
  manualCheckIn,
  type DayUseBookingItem,
  type DayUseBookingsRange,
  type OccupancySummary,
} from '../../lib/api/dayUseBookings'
import { formatBRL } from '../../lib/money'
import { sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './DayUseBookingsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; bookings: DayUseBookingItem[]; summary: OccupancySummary }

const TABS: Array<{ value: DayUseBookingsRange; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'all', label: 'Todas' },
]

/** Formata um timestamp ISO/RFC3339 como "HH:MM" local — mesmo formato do
 * texto de status que o backend já devolve pronto (ver comentário de
 * dayUseBookings.ts); usado só para a atualização OTIMISTA do badge logo
 * após um check-in manual bem-sucedido, antes de qualquer novo GET. */
function formatCheckinTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * DU6 — Reservas Day Use (BEAC-1966, story BEAC-1713 — "Listagem de
 * reservas Day Use com status de check-in"). Markup/copy lidos diretamente
 * do protótipo real (Artifact "Rallye — Financeiro · Saque Noturno",
 * claude.ai/code/artifact/89d79e7b-44f5-4a88-937b-4f36d03f7a45, seção
 * `id="scr-du6"`, HTML salvo em
 * .claude/.../tool-results/artifact-89d79e7b-1783743889-d509.html linhas
 * ~1154-1181): tabs "Hoje"/"Esta semana"/"Todas", lista de reservas (nome +
 * horário/esporte/valor + badge de status), barra de total "Ocupação de
 * hoje", back -> DU5.
 *
 * ## Rota: completa o link pendente de DU5 (BEAC-1955)
 *
 * O botão "Ver reservas" de DayUseConfigPage.tsx já navega para
 * `/units/{id}/day-use/reservas` desde aquela task, mas a rota caía no
 * catch-all (DU6 ainda não existia) — esta task registra a rota de verdade
 * em App.tsx, sem mexer no link já existente.
 *
 * ## Permissão de LEITURA: financeiro OU quadras (AC da story)
 *
 * `usePermission('financeiro','read') || usePermission('quadras','read')` —
 * mesmo espírito OR do backend (middleware.TenantContextForUnitAnyModule,
 * ver comentário de pacote em rallye-api/api/internal/dayuse/list.go).
 * "Esconder sempre" (usePermission.ts): sem nenhum dos dois, o corpo da
 * tela (tabs/lista/barra de total) não renderiza e nenhum fetch é
 * disparado — só a chrome do cabeçalho (back + título) fica visível, mesmo
 * padrão de DayUseConfigPage.tsx.
 *
 * ## Tap-to-check-in exige financeiro:write especificamente (decisão desta
 * task, não coberta explicitamente pelo AC de UI)
 *
 * O backend (BEAC-1965) só aceita o check-in manual sem token de quem tem
 * financeiro:write NA UNIT — não "financeiro:read" nem "quadras:read"
 * (que já bastam pra VER esta lista, ver acima). Um usuário só com
 * quadras:read consegue abrir DU6 mas receberia 403 se tentasse confirmar
 * um check-in manual. Seguindo o mesmo princípio de usePermission.ts
 * ("esconder sempre, nunca desabilitar"), as linhas de reserva AINDA SEM
 * check-in só viram um `<button>` tocável quando
 * `usePermission('financeiro','write')` é true; sem essa permission
 * específica, toda linha é renderizada como um `<div>` não-interativo
 * (mesmo conteúdo visual, sem affordance de toque).
 *
 * ## Um esporte por reserva, não "esportes" (mesma divergência documentada
 * de DayUseQrPage.tsx)
 *
 * O protótipo mostra "Beach tennis, Padel" (plural) numa das linhas de
 * exemplo — mas BookHandler (BEAC-1958) aloca cada reserva de Day Use numa
 * ÚNICA quadra/esporte (ver comentário de pacote em book.go), e é
 * exatamente esse esporte único que a API real de listagem devolve por
 * reserva (BookingListItem.Sport, list.go). Mostrar o esporte singular é o
 * dado real, não uma omissão — mesma decisão já tomada em DayUseQrPage.tsx
 * para o mesmo tipo de divergência entre o mock estático e o modelo de
 * dados real.
 */
export default function DayUseBookingsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  // Hooks nunca chamados condicionalmente (rules-of-hooks): `||` faria
  // curto-circuito e pularia a segunda chamada dependendo da primeira — as
  // duas são sempre avaliadas, só a COMBINAÇÃO (canView) é que aplica o OR
  // do AC da story.
  const hasFinanceiroRead = usePermission('financeiro', 'read')
  const hasQuadrasRead = usePermission('quadras', 'read')
  const canView = hasFinanceiroRead || hasQuadrasRead
  const canCheckIn = usePermission('financeiro', 'write')

  const [tab, setTab] = useState<DayUseBookingsRange>('today')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [checkInErrorId, setCheckInErrorId] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId || !canView) return
      listDayUseBookings(unitId, tab)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', bookings: result.bookings, summary: result.summary })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, canView, tab],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function handleCheckIn(bookingId: string) {
    setCheckingInId(bookingId)
    setCheckInErrorId(null)
    const result = await manualCheckIn(bookingId)
    setCheckingInId(null)

    if (!result.ok) {
      setCheckInErrorId(bookingId)
      return
    }

    const checkedInAt = result.checkedInAt
    setState((prev) =>
      prev.status === 'ready'
        ? {
            ...prev,
            bookings: prev.bookings.map((b) =>
              b.bookingId === bookingId
                ? {
                    ...b,
                    checkedIn: true,
                    checkedInAt,
                    status: `Check-in feito · ${formatCheckinTime(checkedInAt)}`,
                  }
                : b,
            ),
          }
        : prev,
    )
  }

  const backHref = unitId ? `/units/${unitId}/day-use` : '/'

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={backHref}>
          ‹ Config Day Use
        </Link>
        <h1>Reservas de Day Use</h1>
        {state.status === 'ready' ? (
          <span className="count">hoje · {state.summary.confirmedToday}</span>
        ) : null}
        <div className="spacer" />
      </div>

      {!canView ? null : (
        <div className="dash-body">
          <Segmented
            ariaLabel="Filtrar por período"
            options={TABS.map((t) => t.label)}
            value={TABS.find((t) => t.value === tab)?.label}
            onChange={(label) => {
              const next = TABS.find((t) => t.label === label)
              if (!next) return
              setTab(next.value)
              // Mostra "carregando" já na troca de aba (evento de UI, não
              // dentro do corpo de um efeito) — o fetch em si é disparado
              // pelo useEffect que reage a `tab`.
              setState({ status: 'loading' })
            }}
          />

          {state.status === 'loading' ? <PageLoading label="Carregando reservas" variant="list" /> : null}
          {state.status === 'error' ? (
            <p role="alert">Não foi possível carregar as reservas de Day Use desta arena.</p>
          ) : null}

          {state.status === 'ready' ? (
            <>
              <div className="ag-list">
                {state.bookings.length === 0 ? (
                  <p className="hint">Nenhuma reserva de Day Use neste período.</p>
                ) : (
                  state.bookings.map((item) => (
                    <BookingRow
                      key={item.bookingId}
                      item={item}
                      tappable={canCheckIn && !item.checkedIn}
                      pending={checkingInId === item.bookingId}
                      hasError={checkInErrorId === item.bookingId}
                      onCheckIn={() => handleCheckIn(item.bookingId)}
                    />
                  ))
                )}
              </div>

              <div className="total-bar">
                <span>Ocupação de hoje</span>
                <span>
                  {state.summary.confirmedToday} de {state.summary.slotsTotal} vagas ·{' '}
                  {formatBRL(state.summary.amountToday)} arrecadado
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}

      <p className="hint-note">
        Visão administrativa (tipo F2/AL1) das reservas — complementa a visualização na agenda
        operacional do dia.
      </p>
    </AppShell>
  )
}

interface BookingRowProps {
  item: DayUseBookingItem
  tappable: boolean
  pending: boolean
  hasError: boolean
  onCheckIn: () => void
}

function BookingRow({ item, tappable, pending, hasError, onCheckIn }: BookingRowProps) {
  const content = (
    <>
      <span className="iw">
        <span className="nm">{item.studentName}</span>
        <span className="mt">
          {item.startTime}–{item.endTime} · {sportLabel(item.sport)} · {formatBRL(item.amount)}
        </span>
      </span>
      <Badge tone={item.checkedIn ? 'success' : 'warning'}>{item.status}</Badge>
    </>
  )

  return (
    <>
      {tappable ? (
        <button
          type="button"
          className="inv-row"
          data-testid={`booking-row-${item.bookingId}`}
          disabled={pending}
          onClick={onCheckIn}
        >
          {content}
        </button>
      ) : (
        <div className="inv-row inv-row-static" data-testid={`booking-row-${item.bookingId}`}>
          {content}
        </div>
      )}
      {hasError ? (
        <p role="alert" className="booking-checkin-error">
          Não foi possível confirmar o check-in. Tente novamente.
        </p>
      ) : null}
    </>
  )
}
