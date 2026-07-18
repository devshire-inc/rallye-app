// Cliente HTTP de GET/PATCH /teachers/{id}/availability — BEAC-1877 (story
// BEAC-1697, "Agenda de disponibilidade do professor"). Contrato lido
// diretamente do handler REAL (não da descrição da task) em
// rallye-api-beac1697/api/internal/availability/handler.go antes de escrever
// este cliente:
//
//   - GET /teachers/{id}/availability -> { availability: [{ day_of_week,
//     time_slot, available }, ...] } — SEMPRE a grade completa (7 dias x 8
//     faixas = 56 combinações, em ordem determinística), com
//     available=false para qualquer combinação sem linha persistida; leitura
//     da própria disponibilidade sempre liberada ao professor, senão exige
//     permission professores:read.
//   - PATCH /teachers/{id}/availability body { slots: [{ day_of_week,
//     time_slot, available }, ...] } -> devolve a MESMA forma de grade
//     completa já atualizada (batch upsert); exige professores:write, exceto
//     para o próprio professor (dado próprio).
import { apiFetch } from '../httpClient'

/** Espelha timeSlots do handler real (migrations/000030_teacher_availability)
 * — as 8 faixas de 2 horas do doc PR3/PR2, na ordem de exibição da grade. */
export const AVAILABILITY_TIME_SLOTS = [
  '06-08',
  '08-10',
  '10-12',
  '12-14',
  '14-16',
  '16-18',
  '18-20',
  '20-22',
] as const

export type AvailabilityTimeSlot = (typeof AVAILABILITY_TIME_SLOTS)[number]

/** 0-6, mesmo CHECK(day_of_week BETWEEN 0 AND 6) do handler real. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek
  timeSlot: AvailabilityTimeSlot
  available: boolean
}

type AvailabilitySlotWire = {
  day_of_week: DayOfWeek
  time_slot: AvailabilityTimeSlot
  available: boolean
}

function fromWire(wire: AvailabilitySlotWire): AvailabilitySlot {
  return { dayOfWeek: wire.day_of_week, timeSlot: wire.time_slot, available: wire.available }
}

function toWire(slot: AvailabilitySlot): AvailabilitySlotWire {
  return { day_of_week: slot.dayOfWeek, time_slot: slot.timeSlot, available: slot.available }
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

export interface GetAvailabilitySuccess {
  ok: true
  availability: AvailabilitySlot[]
}

export type GetAvailabilityResult = GetAvailabilitySuccess | ApiFailure

/** GET /teachers/{id}/availability */
export async function getAvailability(teacherId: string): Promise<GetAvailabilityResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}/availability`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { availability: AvailabilitySlotWire[] }
  return { ok: true, availability: body.availability.map(fromWire) }
}

export type PatchAvailabilityResult = GetAvailabilitySuccess | ApiFailure

/** PATCH /teachers/{id}/availability — batch upsert de uma ou mais faixas;
 * devolve a grade completa já atualizada (mesma forma de getAvailability). */
export async function patchAvailability(
  teacherId: string,
  slots: AvailabilitySlot[],
): Promise<PatchAvailabilityResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ slots: slots.map(toWire) }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { availability: AvailabilitySlotWire[] }
  return { ok: true, availability: body.availability.map(fromWire) }
}
