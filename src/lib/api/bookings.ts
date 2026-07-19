// Cliente HTTP de /units/{id}/bookings e /bookings/{id} (BEAC-1902/1904/1905,
// story BEAC-1704 "CRUD de turma com recorrência semanal") — alimenta o grid
// AG1/AG2 (BEAC-1903), o sheet "Nova reserva" AG6 (BEAC-1904) e o cancelamento
// básico de AG5 (BEAC-1905). Mesmo padrão de src/lib/api/students.ts: usa
// apiFetch, não fetch cru.
//
// GET /units/{id}/bookings já existia (api/internal/bookings/handler.go,
// GridHandler). POST /units/{id}/bookings e PATCH /bookings/{id} são NOVOS,
// adicionados como parte deste mesmo dispatch (não existiam nenhum endpoint
// de criação para os tipos private/adhoc/block, nem de cancelamento) — ver
// contrato exato no handler real; só o tipo "class_occurrence" (Turma)
// continua sendo criado via POST /units/{id}/classes (../api/classes.ts), não
// por aqui.
import { apiFetch } from '../httpClient'

/** Espelha o CHECK de public.bookings.type (migrations/000034). */
export type BookingType = 'class_occurrence' | 'private' | 'rental' | 'adhoc' | 'block'

/** Espelha o CHECK de public.bookings.status (migrations/000034). */
export type BookingStatus = 'confirmed' | 'cancelled'

export interface Booking {
  id: string
  courtId: string
  courtName: string
  type: BookingType
  classId: string | null
  className: string | null
  /** ISO/RFC3339. */
  startAt: string
  /** ISO/RFC3339. */
  endAt: string
  status: BookingStatus
  teacherName: string | null
  studentName: string | null
  responsibleName: string | null
  reason: string | null
}

type BookingWire = {
  id: string
  court_id: string
  court_name: string
  type: BookingType
  class_id?: string
  class_name?: string
  start_at: string
  end_at: string
  status: BookingStatus
  teacher_name?: string
  student_name?: string
  responsible_name?: string
  reason?: string
}

function fromWire(wire: BookingWire): Booking {
  return {
    id: wire.id,
    courtId: wire.court_id,
    courtName: wire.court_name,
    type: wire.type,
    classId: wire.class_id ?? null,
    className: wire.class_name ?? null,
    startAt: wire.start_at,
    endAt: wire.end_at,
    status: wire.status,
    teacherName: wire.teacher_name ?? null,
    studentName: wire.student_name ?? null,
    responsibleName: wire.responsible_name ?? null,
    reason: wire.reason ?? null,
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

export interface GetBookingsGridSuccess {
  ok: true
  bookings: Booking[]
  /** true quando o chamador é Professor — AC "QUANDO Professor, esconder o
   * FAB e desabilitar tap em slot vazio (view-only)" de AG1/AG2. */
  viewOnly: boolean
}

export type GetBookingsGridResult = GetBookingsGridSuccess | ApiFailure

/**
 * GET /units/{id}/bookings?from&to&court_id&student_id= — grid de agenda
 * por período.
 *
 * `studentId` (correção de review de BEAC-1926/"Minha Agenda") escopa a
 * resposta às reservas cujo `student_id` bate — hoje isso só filtra
 * type=private/day_use (os únicos tipos que carregam student_id no
 * backend; ver comentário de `queryBookings` em
 * rallye-api/api/internal/bookings/handler.go). type=class_occurrence
 * (turmas) NUNCA é filtrado por este parâmetro — não existe
 * `class_enrollments` no backend para saber quais turmas um aluno
 * frequenta (gap já reportado). Chamadores que quiserem "só as reservas
 * deste aluno" ainda vão ver ocorrências de turma de QUALQUER aluno da
 * unit — ver AG3StudentAgendaPage.tsx para o halt-and-report completo
 * sobre por que esta função não consegue, hoje, ser chamada com o id do
 * PRÓPRIO usuário logado.
 */
export async function getBookingsGrid(
  unitId: string,
  from: string,
  to: string,
  courtId?: string,
  studentId?: string,
): Promise<GetBookingsGridResult> {
  const params = new URLSearchParams({ from, to })
  if (courtId) params.set('court_id', courtId)
  if (studentId) params.set('student_id', studentId)

  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/bookings?${params.toString()}`,
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { bookings: BookingWire[]; view_only: boolean }
  return { ok: true, bookings: body.bookings.map(fromWire), viewOnly: body.view_only }
}

/** Os 3 tipos criáveis por este endpoint (AC de AG6/BEAC-1904 — os
 * type-pills "Particular"/"Avulsa"/"Bloqueio"; "Turma" cria via
 * POST /units/{id}/classes, ../api/classes.ts; "rental" não tem entrada de
 * UI neste dispatch). */
export type CreateBookingType = 'private' | 'adhoc' | 'block'

export interface CreateBookingPayload {
  type: CreateBookingType
  courtId: string
  /** ISO/RFC3339. */
  startAt: string
  /** ISO/RFC3339. */
  endAt: string
  /** Obrigatório para type=private. */
  teacherId?: string
  /** Obrigatório para type=private. */
  studentId?: string
  /** Obrigatório para type=adhoc (nome do responsável). */
  responsibleName?: string
  /** Obrigatório para type=block (motivo). Reaproveitado para as
   * "observações" opcionais de type=adhoc — ver comentário do handler real
   * (rallye-api/api/internal/bookings) sobre por que não há uma coluna
   * dedicada de observações. */
  reason?: string
}

export interface CreateBookingSuccess {
  ok: true
  booking: Booking
}

export type CreateBookingResult = CreateBookingSuccess | ApiFailure

/** POST /units/{id}/bookings — cria uma reserva particular/avulsa/bloqueio. */
export async function createBooking(
  unitId: string,
  payload: CreateBookingPayload,
): Promise<CreateBookingResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/bookings`, {
    method: 'POST',
    body: JSON.stringify({
      type: payload.type,
      court_id: payload.courtId,
      start_at: payload.startAt,
      end_at: payload.endAt,
      teacher_id: payload.teacherId,
      student_id: payload.studentId,
      responsible_name: payload.responsibleName,
      reason: payload.reason,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as BookingWire
  return { ok: true, booking: fromWire(body) }
}

export interface CancelBookingSuccess {
  ok: true
  booking: Booking
}

export type CancelBookingResult = CancelBookingSuccess | ApiFailure

/**
 * PATCH /bookings/{id} — cancelamento BÁSICO (status=cancelled +
 * cancelled_reason), usado pela ação admin "Cancelar aula" de AG5
 * (BEAC-1905). NÃO dispara geração de crédito — isso depende de
 * BEAC-1909/1913 (story BEAC-1705, fora do escopo deste dispatch); ver
 * comentário de AG5BookingDetailPage.tsx para o halt-and-report completo.
 */
export async function cancelBooking(bookingId: string, reason: string): Promise<CancelBookingResult> {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as BookingWire
  return { ok: true, booking: fromWire(body) }
}

// ---------------------------------------------------------------------------
// POST /bookings/{id}/participants (BEAC-1917, story BEAC-1707 — "Botão de
// adicionar aluno extra em AG5 com aviso de capacidade")
// ---------------------------------------------------------------------------

export interface Participant {
  id: string
  bookingId: string
  studentId: string
  studentName: string | null
  source: 'enrollment' | 'manual'
  addedBy: string
  /** ISO/RFC3339. */
  addedAt: string
  /** true quando esta adição ultrapassou public.classes.capacity — AC
   * central de BEAC-1707: "avisa, não bloqueia" (mesmo padrão do Épico 4).
   * O aluno JÁ foi adicionado quando este campo vem true — não é uma
   * confirmação pendente, é só um aviso informativo. */
  capacityWarning: boolean
}

type ParticipantWire = {
  id: string
  booking_id: string
  student_id: string
  student_name?: string
  source: 'enrollment' | 'manual'
  added_by: string
  added_at: string
  capacity_warning: boolean
}

function participantFromWire(wire: ParticipantWire): Participant {
  return {
    id: wire.id,
    bookingId: wire.booking_id,
    studentId: wire.student_id,
    studentName: wire.student_name ?? null,
    source: wire.source,
    addedBy: wire.added_by,
    addedAt: wire.added_at,
    capacityWarning: wire.capacity_warning,
  }
}

export interface AddParticipantSuccess {
  ok: true
  participant: Participant
}

export type AddParticipantResult = AddParticipantSuccess | ApiFailure

/**
 * POST /bookings/{id}/participants — adiciona um aluno avulso (source=manual)
 * ao booking. Sempre cria a linha quando a resposta é 2xx (mesmo quando a
 * capacidade da turma é ultrapassada — `capacity_warning: true` no corpo, não
 * um erro); 409 `already_participant` quando o aluno já foi adicionado a este
 * booking (UNIQUE(booking_id, student_id), migrations/000035).
 */
export async function addBookingParticipant(
  bookingId: string,
  studentId: string,
): Promise<AddParticipantResult> {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/participants`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ParticipantWire
  return { ok: true, participant: participantFromWire(body) }
}

// ---------------------------------------------------------------------------
// GET /bookings/{id}/participants (BEAC-1907, story BEAC-1704 — dispatch
// ad-hoc de encerramento): lista os participantes de um booking, incluindo
// o resultado de presença já registrado (se houver).
//
// GAP COBERTO POR ESTA TASK: não existia nenhum endpoint de LEITURA da lista
// de participantes de um booking — só escrita (POST .../participants,
// POST .../attendance). A tela T3 (check-in de presença) não tem como
// mostrar "lista de alunos da aula" sem isso, então esse endpoint mínimo
// (GET, reaproveitando 100% o padrão de autorização já usado pelos outros
// endpoints deste arquivo) foi adicionado como parte desta dispatch — ver
// api/internal/bookings/list_participants_handler.go no rallye-api.
// ---------------------------------------------------------------------------

/** Espelha o CHECK de public.booking_participants.attendance_status
 * (migrations/000037, BEAC-1971) — NULL até o check-in acontecer. */
export type AttendanceStatus = 'presente' | 'falta' | 'justificada'

export interface BookingParticipant {
  id: string
  bookingId: string
  studentId: string
  studentName: string | null
  source: 'enrollment' | 'manual'
  /** null até o check-in (POST /bookings/{id}/attendance) acontecer. */
  attendanceStatus: AttendanceStatus | null
  /** ISO/RFC3339, ou null até o check-in acontecer. */
  checkedInAt: string | null
}

type BookingParticipantWire = {
  id: string
  booking_id: string
  student_id: string
  student_name?: string
  source: 'enrollment' | 'manual'
  attendance_status?: AttendanceStatus
  checked_in_at?: string
}

function bookingParticipantFromWire(wire: BookingParticipantWire): BookingParticipant {
  return {
    id: wire.id,
    bookingId: wire.booking_id,
    studentId: wire.student_id,
    studentName: wire.student_name ?? null,
    source: wire.source,
    attendanceStatus: wire.attendance_status ?? null,
    checkedInAt: wire.checked_in_at ?? null,
  }
}

export interface ListBookingParticipantsSuccess {
  ok: true
  participants: BookingParticipant[]
}

export type ListBookingParticipantsResult = ListBookingParticipantsSuccess | ApiFailure

/** GET /bookings/{id}/participants — lista de alunos da aula, usada pela
 * tela T3 (check-in de presença) para montar o roster. */
export async function listBookingParticipants(bookingId: string): Promise<ListBookingParticipantsResult> {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/participants`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { participants: BookingParticipantWire[] }
  return { ok: true, participants: body.participants.map(bookingParticipantFromWire) }
}

// ---------------------------------------------------------------------------
// POST /bookings/{id}/attendance (BEAC-1906, story BEAC-1704): check-in de
// presença em lote — consumido pela tela T3 (BEAC-1907).
// ---------------------------------------------------------------------------

export interface AttendanceEntry {
  studentId: string
  status: AttendanceStatus
}

export interface AttendanceItemResult {
  studentId: string
  attendanceStatus: AttendanceStatus
  /** ISO/RFC3339. */
  checkedInAt: string
  /** true quando esta gravação disparou o alerta de 3 faltas consecutivas
   * (BEAC-1906) — informativo, T3 não precisa agir sobre isto (AC da tela
   * não pede exibição do alerta). */
  consecutiveFaltasAlert: boolean
}

export interface SubmitAttendanceSuccess {
  ok: true
  bookingId: string
  /** true quando o check-in foi feito fora da janela [start_at-15min,
   * start_at+30min] (BEAC-1906) — AC "Banner 'Check-in fora do horário.
   * Registrando retroativamente.'" de T3. */
  retroactive: boolean
  results: AttendanceItemResult[]
}

export type SubmitAttendanceResult = SubmitAttendanceSuccess | ApiFailure

/**
 * POST /bookings/{id}/attendance — grava presença em lote. 403
 * `attendance_edit_locked` quando um Professor tenta editar depois de 24h do
 * fim da aula (só Admin pode depois disso, ver comentário de pacote do
 * handler real) — surge como ApiFailure comum, o chamador decide como
 * mostrar (AC de T3: "surface an honest error, don't silently allow the UI
 * to proceed as if it worked").
 */
export async function submitAttendance(
  bookingId: string,
  attendances: AttendanceEntry[],
): Promise<SubmitAttendanceResult> {
  const response = await apiFetch(`/bookings/${encodeURIComponent(bookingId)}/attendance`, {
    method: 'POST',
    body: JSON.stringify({
      attendances: attendances.map((a) => ({ student_id: a.studentId, status: a.status })),
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    booking_id: string
    retroactive: boolean
    results: Array<{
      student_id: string
      attendance_status: AttendanceStatus
      checked_in_at: string
      consecutive_faltas_alert?: boolean
    }>
  }
  return {
    ok: true,
    bookingId: body.booking_id,
    retroactive: body.retroactive,
    results: body.results.map((r) => ({
      studentId: r.student_id,
      attendanceStatus: r.attendance_status,
      checkedInAt: r.checked_in_at,
      consecutiveFaltasAlert: r.consecutive_faltas_alert ?? false,
    })),
  }
}
