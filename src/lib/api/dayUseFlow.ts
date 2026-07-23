// Cliente HTTP de GET /day-use/discover (BEAC-1956, DU1) + GET /units/{id}/
// day-use-detail (BEAC-1957, DU2) — story BEAC-1928, "Fluxo de reserva de
// Day Use para usuário". Contrato confirmado lendo a implementação real dos
// handlers (rallye-api/api/internal/dayuse/discover.go, detail.go, mesma
// dispatch) em vez de assumir pela descrição da task.
//
// Deliberadamente um arquivo SEPARADO de lib/api/dayUse.ts (cliente de DU5,
// BEAC-1954): DU5 é config administrativa (financeiro:write, unit-scoped),
// este arquivo é o fluxo de DESCOBERTA do usuário final (sem permission
// dedicada, cross-tenant) — endpoints/contratos/autorização
// completamente diferentes, só o domínio (Day Use) é compartilhado.
import { apiFetch } from '../httpClient'

/** ISO local date (YYYY-MM-DD) de "hoje" — mesmo formato que o backend
 * espera em `?date=`/`date` (GET /day-use/discover, POST /units/{id}/
 * day-use-bookings). Usa os componentes LOCAIS do Date (não toISOString,
 * que é UTC) para não virar o dia errado perto da meia-noite em fusos
 * negativos como o do Brasil. Extraído de DayUseDiscoveryPage.tsx (BEAC-1960)
 * pra DU3 (BEAC-1962) reaproveitar o MESMO default "hoje" sem duplicar —
 * DU2 (BEAC-1961) não repassa `date` no state de navegação pra DU3 (gap
 * pré-existente daquela dispatch, ver comentário em DayUseDetailPage.tsx),
 * então DU3 precisa do mesmo fallback que DU1 já usa. */
export function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface ArenaSummary {
  unitId: string
  name: string
  address: string
  sports: string[]
  price: number
  slotsLeft: number
  lotado: boolean
}

interface ArenaSummaryWire {
  unit_id: string
  name: string
  address: string
  sports: string[]
  price: number
  slots_left: number
  lotado: boolean
}

function arenaSummaryFromWire(wire: ArenaSummaryWire): ArenaSummary {
  return {
    unitId: wire.unit_id,
    name: wire.name,
    address: wire.address,
    sports: wire.sports,
    price: wire.price,
    slotsLeft: wire.slots_left,
    lotado: wire.lotado,
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}

export interface DiscoverDayUseFilters {
  city?: string
  sport?: string
  date?: string
  search?: string
}

export interface DiscoverDayUseSuccess {
  ok: true
  arenas: ArenaSummary[]
}

export type DiscoverDayUseResult = DiscoverDayUseSuccess | ApiFailure

/** GET /day-use/discover?city=&sport=&date=&search= — DU1. Cross-tenant:
 * lista arenas de QUALQUER tenant com Day Use disponível na data pedida.
 * Qualquer sessão válida pode chamar (sem permission dedicada). */
export async function discoverDayUse(
  filters: DiscoverDayUseFilters = {},
): Promise<DiscoverDayUseResult> {
  const params = new URLSearchParams()
  if (filters.city) params.set('city', filters.city)
  if (filters.sport) params.set('sport', filters.sport)
  if (filters.date) params.set('date', filters.date)
  if (filters.search) params.set('search', filters.search)
  const query = params.toString()

  const response = await apiFetch(`/day-use/discover${query ? `?${query}` : ''}`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ArenaSummaryWire[]
  return { ok: true, arenas: body.map(arenaSummaryFromWire) }
}

export interface DayUseInfo {
  price: number
  startTime: string
  endTime: string
  sports: string[]
  slotsTotal: number
  slotsLeft: number
  lotado: boolean
}

interface DayUseInfoWire {
  price: number
  start_time: string
  end_time: string
  sports: string[]
  slots_total: number
  slots_left: number
  lotado: boolean
}

export interface DayUseDetail {
  unitId: string
  name: string
  address: string
  city: string | null
  state: string | null
  photos: string[]
  rating: number | null
  courtsSummary: string
  dayUse: DayUseInfo | null
}

interface DayUseDetailWire {
  unit_id: string
  name: string
  address: string
  city: string | null
  state: string | null
  photos: string[]
  rating: number | null
  courts_summary: string
  day_use: DayUseInfoWire | null
}

function dayUseDetailFromWire(wire: DayUseDetailWire): DayUseDetail {
  return {
    unitId: wire.unit_id,
    name: wire.name,
    address: wire.address,
    city: wire.city,
    state: wire.state,
    photos: wire.photos,
    rating: wire.rating,
    courtsSummary: wire.courts_summary,
    dayUse: wire.day_use
      ? {
          price: wire.day_use.price,
          startTime: wire.day_use.start_time,
          endTime: wire.day_use.end_time,
          sports: wire.day_use.sports,
          slotsTotal: wire.day_use.slots_total,
          slotsLeft: wire.day_use.slots_left,
          lotado: wire.day_use.lotado,
        }
      : null,
  }
}

export interface GetDayUseDetailSuccess {
  ok: true
  detail: DayUseDetail
}

export type GetDayUseDetailResult = GetDayUseDetailSuccess | ApiFailure

/** GET /units/{id}/day-use-detail?date= — DU2. `detail.dayUse` é `null`
 * quando a arena não tem nenhuma quadra elegível pra Day Use na data
 * pedida (arena existe, CTA de reservar deve ficar desabilitado/oculto). */
export async function getDayUseDetail(
  unitId: string,
  date?: string,
): Promise<GetDayUseDetailResult> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/day-use-detail${query}`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DayUseDetailWire
  return { ok: true, detail: dayUseDetailFromWire(body) }
}

export interface DayUseBooking {
  id: string
  unitId: string
  courtId: string
  sport: string
  date: string
  startTime: string
  endTime: string
  price: number
  invoiceId: string
}

interface DayUseBookingWire {
  id: string
  unit_id: string
  court_id: string
  sport: string
  date: string
  start_time: string
  end_time: string
  price: number
  invoice_id: string
}

function dayUseBookingFromWire(wire: DayUseBookingWire): DayUseBooking {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    courtId: wire.court_id,
    sport: wire.sport,
    date: wire.date,
    startTime: wire.start_time,
    endTime: wire.end_time,
    price: wire.price,
    invoiceId: wire.invoice_id,
  }
}

export interface BookDayUseSuccess {
  ok: true
  booking: DayUseBooking
}

/** Único caso de falha com significado próprio pra DU3 (BEAC-1962): a vaga
 * foi preenchida por outra reserva concorrente entre o carregamento da tela
 * e o clique em "CONFIRMAR E PAGAR" (409, ver dayuse.writeNoSlotsAvailable
 * no backend). Demais falhas (rede, 401, 404 de unit) caem em ApiFailure
 * genérico. */
export interface BookDayUseSlotTaken {
  ok: false
  slotTaken: true
}

export type BookDayUseResult = BookDayUseSuccess | BookDayUseSlotTaken | ApiFailure

/** POST /units/{id}/day-use-bookings — DU3 (BEAC-1958/1962). Confirma a
 * reserva de forma ATÔMICA e definitiva: sem hold/timer/etapa de pagamento
 * real (Abacate Pay é pós-MVP, mesmo gap já aceito em F3/F5/PL5) — um único
 * clique em "CONFIRMAR E PAGAR" chama isto diretamente. */
export async function bookDayUse(unitId: string, date: string): Promise<BookDayUseResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/day-use-bookings`, {
    method: 'POST',
    body: JSON.stringify({ date }),
  })

  if (!response.ok) {
    if (response.status === 409) {
      return { ok: false, slotTaken: true }
    }
    return failureFrom(response)
  }

  const body = (await response.json()) as DayUseBookingWire
  return { ok: true, booking: dayUseBookingFromWire(body) }
}

export interface DayUseQr {
  bookingId: string
  unitName: string
  address: string
  sport: string
  date: string
  startTime: string
  endTime: string
  amountPaid: number
  token: string
  checkedIn: boolean
  checkedInAt: string | null
  expired: boolean
}

interface DayUseQrWire {
  booking_id: string
  unit_name: string
  address: string
  sport: string
  date: string
  start_time: string
  end_time: string
  amount_paid: number
  token: string
  checked_in: boolean
  checked_in_at: string | null
  expired: boolean
}

function dayUseQrFromWire(wire: DayUseQrWire): DayUseQr {
  return {
    bookingId: wire.booking_id,
    unitName: wire.unit_name,
    address: wire.address,
    sport: wire.sport,
    date: wire.date,
    startTime: wire.start_time,
    endTime: wire.end_time,
    amountPaid: wire.amount_paid,
    token: wire.token,
    checkedIn: wire.checked_in,
    checkedInAt: wire.checked_in_at,
    expired: wire.expired,
  }
}

export interface GetDayUseQrSuccess {
  ok: true
  qr: DayUseQr
}

export type GetDayUseQrResult = GetDayUseQrSuccess | ApiFailure

/** GET /day-use-bookings/{id}/qr — DU4 (BEAC-1959/1963). Self-only no
 * backend (404 se a reserva não é do chamador) — `qr.expired` reflete a
 * checagem lógica "dia já passou sem check-in" (sem job, recalculada a cada
 * leitura). */
export async function getDayUseQr(bookingId: string): Promise<GetDayUseQrResult> {
  const response = await apiFetch(`/day-use-bookings/${encodeURIComponent(bookingId)}/qr`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DayUseQrWire
  return { ok: true, qr: dayUseQrFromWire(body) }
}
