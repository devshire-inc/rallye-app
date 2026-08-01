// Cliente HTTP de GET /units/{id}/classes/occurrences e
// POST /units/{id}/classes/{classId}/occurrences/book — backend novo que
// habilita o fluxo self-service "Agendar aula" (Aluno), telas
// AgendarEscolherHorarioPage.tsx/AgendarConfirmarPage.tsx. Mesmo padrão de
// src/lib/api/bookings.ts: usa apiFetch, não fetch cru.
import { apiFetch } from '../httpClient'

export interface ClassOccurrence {
  classId: string
  className: string
  sport: string
  courtId: string
  teacherId: string
  /** ISO/RFC3339. */
  startAt: string
  /** ISO/RFC3339. */
  endAt: string
  capacity: number
  availableSeats: number
  /** null quando a turma ainda não tem preço configurado — chamador decide
   * como tratar (ver comentário de AgendarEscolherHorarioPage.tsx). */
  priceCents: number | null
  level: string | null
}

type ClassOccurrenceWire = {
  class_id: string
  class_name: string
  sport: string
  court_id: string
  teacher_id: string
  start_at: string
  end_at: string
  capacity: number
  available_seats: number
  price_cents: number | null
  level: string | null
}

function fromWire(wire: ClassOccurrenceWire): ClassOccurrence {
  return {
    classId: wire.class_id,
    className: wire.class_name,
    sport: wire.sport,
    courtId: wire.court_id,
    teacherId: wire.teacher_id,
    startAt: wire.start_at,
    endAt: wire.end_at,
    capacity: wire.capacity,
    availableSeats: wire.available_seats,
    priceCents: wire.price_cents,
    level: wire.level,
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error', message: body.message }
}

export interface ListClassOccurrencesSuccess {
  ok: true
  occurrences: ClassOccurrence[]
}

export type ListClassOccurrencesResult = ListClassOccurrencesSuccess | ApiFailure

/** GET /units/{id}/classes/occurrences?sport=&from=&to= — ocorrências
 * futuras de turmas com vaga, usada pela tela "Escolher Horário" do fluxo
 * self-service. */
export async function listClassOccurrences(
  unitId: string,
  sport?: string,
  from?: string,
  to?: string,
): Promise<ListClassOccurrencesResult> {
  const params = new URLSearchParams()
  if (sport) params.set('sport', sport)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()

  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/classes/occurrences${query ? `?${query}` : ''}`,
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { occurrences: ClassOccurrenceWire[] }
  return { ok: true, occurrences: body.occurrences.map(fromWire) }
}

export interface BookClassOccurrenceSuccess {
  ok: true
  bookingId: string
  classId: string
  /** ISO/RFC3339. */
  startAt: string
  /** ISO/RFC3339. */
  endAt: string
  status: string
  participantId: string
  studentId: string
  /** ISO/RFC3339. */
  addedAt: string
}

export type BookClassOccurrenceResult = BookClassOccurrenceSuccess | ApiFailure

/**
 * POST /units/{id}/classes/{classId}/occurrences/book — o aluno logado
 * reserva a própria vaga na ocorrência. Erros possíveis (ver chamador para
 * tratamento): 404 `class_not_found`, 409 `class_inactive`, 400
 * `invalid_occurrence`, 409 `occurrence_full`, 409 `already_booked`, 400
 * `invalid_body`.
 */
export async function bookClassOccurrence(
  unitId: string,
  classId: string,
  startAt: string,
): Promise<BookClassOccurrenceResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/classes/${encodeURIComponent(classId)}/occurrences/book`,
    {
      method: 'POST',
      body: JSON.stringify({ start_at: startAt }),
    },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    booking_id: string
    class_id: string
    start_at: string
    end_at: string
    status: string
    participant_id: string
    student_id: string
    added_at: string
  }
  return {
    ok: true,
    bookingId: body.booking_id,
    classId: body.class_id,
    startAt: body.start_at,
    endAt: body.end_at,
    status: body.status,
    participantId: body.participant_id,
    studentId: body.student_id,
    addedAt: body.added_at,
  }
}
