// Cliente HTTP de GET /units/{id}/day-use-bookings?range=today|week|all +
// POST /day-use-bookings/{id}/check-in (BEAC-1964/BEAC-1965, story BEAC-1713
// — "Listagem de reservas Day Use com status de check-in (DU6)"). Contrato
// confirmado lendo a implementação real dos handlers
// (rallye-api/api/internal/dayuse/list.go + checkin.go, mesma dispatch) em
// vez de assumir pela descrição da task — mesmo padrão de src/lib/api/
// dayUse.ts.
import { apiFetch } from '../httpClient'

export interface DayUseBookingItem {
  bookingId: string
  studentName: string
  startTime: string
  endTime: string
  sport: string
  amount: number
  checkedIn: boolean
  /** ISO/RFC3339, ou null antes do check-in. */
  checkedInAt: string | null
  /** Texto pronto pro badge, já formatado pelo backend: "Check-in feito ·
   * HH:MM" ou "Aguardando check-in" (AC explícito de BEAC-1964). */
  status: string
}

export interface OccupancySummary {
  confirmedToday: number
  slotsTotal: number
  amountToday: number
}

type BookingItemWire = {
  booking_id: string
  student_name: string
  start_time: string
  end_time: string
  sport: string
  amount: number
  checked_in: boolean
  checked_in_at: string | null
  status: string
}

type OccupancySummaryWire = {
  confirmed_today: number
  slots_total: number
  amount_today: number
}

type BookingListWire = {
  bookings: BookingItemWire[]
  summary: OccupancySummaryWire
}

function bookingFromWire(wire: BookingItemWire): DayUseBookingItem {
  return {
    bookingId: wire.booking_id,
    studentName: wire.student_name,
    startTime: wire.start_time,
    endTime: wire.end_time,
    sport: wire.sport,
    amount: wire.amount,
    checkedIn: wire.checked_in,
    checkedInAt: wire.checked_in_at,
    status: wire.status,
  }
}

function summaryFromWire(wire: OccupancySummaryWire): OccupancySummary {
  return {
    confirmedToday: wire.confirmed_today,
    slotsTotal: wire.slots_total,
    amountToday: wire.amount_today,
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

export type DayUseBookingsRange = 'today' | 'week' | 'all'

export interface ListDayUseBookingsSuccess {
  ok: true
  bookings: DayUseBookingItem[]
  summary: OccupancySummary
}

export type ListDayUseBookingsResult = ListDayUseBookingsSuccess | ApiFailure

/** GET /units/{id}/day-use-bookings?range=today|week|all — reservas de
 * TODAS as quadras da unit, centralizadas (AC da story), + o resumo de
 * ocupação de hoje (sempre presente, independente do `range` pedido —
 * mesmo comportamento do backend real). Autorização (financeiro OU quadras,
 * leitura) é do backend — este cliente só repassa o resultado. */
export async function listDayUseBookings(
  unitId: string,
  range: DayUseBookingsRange,
): Promise<ListDayUseBookingsResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/day-use-bookings?range=${range}`,
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as BookingListWire
  return {
    ok: true,
    bookings: body.bookings.map(bookingFromWire),
    summary: summaryFromWire(body.summary),
  }
}

export interface ManualCheckInSuccess {
  ok: true
  bookingId: string
  /** ISO/RFC3339. */
  checkedInAt: string
}

export type ManualCheckInResult = ManualCheckInSuccess | ApiFailure

/** POST /day-use-bookings/{id}/check-in SEM `token` (BEAC-1965: check-in
 * manual pela recepção, a partir da tela DU6) — o mesmo endpoint de DU4,
 * autorizado aqui por financeiro:write em vez de posse do QR. Um 403
 * significa que o chamador não tem essa permission na unit dona da reserva
 * — a tela já esconde o tap-to-check-in de quem não tem financeiro:write
 * (usePermission, "esconder sempre"), então este caso não deveria ser
 * alcançável pela UI normal. Um 409 (already_checked_in/day_use_expired)
 * pode acontecer por corrida (outra recepção/QR já confirmou entretanto) —
 * o chamador decide como mostrar. */
export async function manualCheckIn(bookingId: string): Promise<ManualCheckInResult> {
  const response = await apiFetch(`/day-use-bookings/${encodeURIComponent(bookingId)}/check-in`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { booking_id: string; checked_in_at: string }
  return { ok: true, bookingId: body.booking_id, checkedInAt: body.checked_in_at }
}
