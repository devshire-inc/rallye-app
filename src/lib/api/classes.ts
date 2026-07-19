// Cliente HTTP de POST/GET /units/{id}/classes e PATCH/DELETE /classes/{id}
// (BEAC-1899/BEAC-1900/BEAC-1901, rallye-api/api/internal/classes/handler.go)
// — consumido pelo tipo "Turma" de AG6 (BEAC-1904, seletor de turma existente
// + "+ Criar nova turma") e por T1/T2 (BEAC-1900/1901, lista de turmas +
// detalhe/edição). Mesmo padrão de src/lib/api/students.ts: usa apiFetch, não
// fetch cru.
//
// Contrato confirmado lendo o handler real (não a descrição da task): ver
// api/internal/classes/handler.go, ClassResponse/CreateRequest — POST/PATCH/
// DELETE devolvem o objeto completo (sem teacher_name/court_name — só
// LISTAGEM enriquece via JOIN, ver ClassListItem no handler real e
// `RallyeClass.teacherName/courtName` abaixo, ambos opcionais por isso), GET
// devolve um array enriquecido com nome do professor/quadra (T1 e o
// cabeçalho de T2 precisam de nome, não de UUID).
//
// # Gap conhecido — matrícula (ocupação real) não existe
//
// Nenhum endpoint aqui devolve quantos alunos estão matriculados numa turma:
// public.class_enrollments não existe no backend (confirmado por busca no
// repositório inteiro de rallye-api — ver comentário de pacote em
// api/internal/classes/handler.go). Por isso `RallyeClass` NUNCA tem um campo
// `enrolled`/`occupied` — inventar esse número aqui seria fabricar dado que o
// backend não tem. T1/T2 tratam a ocupação como "capacidade conhecida
// (capacity), matrícula desconhecida" em vez de calcular uma barra de "%
// cheio" real (ver TurmasListPage/TurmaDetailPage).
import { apiFetch } from '../httpClient'

export interface CreateClassPayload {
  teacherId: string
  sport: string
  name: string
  courtId: string
  /** RRULE (RFC 5545), ex.: "FREQ=WEEKLY;BYDAY=TU,TH". */
  rrule: string
  /** "HH:MM". */
  startTime: string
  /** "HH:MM". */
  endTime: string
  capacity: number
  level?: string
}

export type ClassStatus = 'active' | 'inactive'

export interface RallyeClass {
  id: string
  unitId: string
  teacherId: string
  /** Só presente em GET /units/{id}/classes (LISTAGEM) — o backend
   * enriquece via LEFT JOIN em public.profiles; POST/PATCH/DELETE não
   * devolvem isso (undefined nesses casos, ver comentário de módulo). */
  teacherName?: string
  sport: string
  name: string
  courtId: string
  /** Só presente em GET /units/{id}/classes — ver teacherName acima. */
  courtName?: string
  rrule: string
  startTime: string
  endTime: string
  capacity: number
  level: string | null
  status: ClassStatus
}

type ClassWire = {
  id: string
  unit_id: string
  teacher_id: string
  teacher_name?: string
  sport: string
  name: string
  court_id: string
  court_name?: string
  rrule: string
  start_time: string
  end_time: string
  capacity: number
  level: string | null
  status: ClassStatus
}

function fromWire(wire: ClassWire): RallyeClass {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    teacherId: wire.teacher_id,
    teacherName: wire.teacher_name,
    sport: wire.sport,
    name: wire.name,
    courtId: wire.court_id,
    courtName: wire.court_name,
    rrule: wire.rrule,
    startTime: wire.start_time,
    endTime: wire.end_time,
    capacity: wire.capacity,
    level: wire.level,
    status: wire.status,
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

export interface CreateClassSuccess {
  ok: true
  rallyeClass: RallyeClass
}

export type CreateClassResult = CreateClassSuccess | ApiFailure

/** POST /units/{id}/classes — cria uma turma. A materialização das
 * ocorrências (RRULE -> bookings) acontece de forma lazy, na próxima chamada
 * de GET /units/{id}/bookings que cobrir a janela (BEAC-1898) — este cliente
 * não precisa (nem deve) chamar mais nada depois do POST. */
export async function createClass(
  unitId: string,
  payload: CreateClassPayload,
): Promise<CreateClassResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/classes`, {
    method: 'POST',
    body: JSON.stringify({
      teacher_id: payload.teacherId,
      sport: payload.sport,
      name: payload.name,
      court_id: payload.courtId,
      rrule: payload.rrule,
      start_time: payload.startTime,
      end_time: payload.endTime,
      capacity: payload.capacity,
      level: payload.level,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ClassWire
  return { ok: true, rallyeClass: fromWire(body) }
}

export interface ListClassesSuccess {
  ok: true
  classes: RallyeClass[]
}

export type ListClassesResult = ListClassesSuccess | ApiFailure

/** GET /units/{id}/classes — lista turmas da unit (ativas e inativas;
 * Professor vê só as suas — decidido pelo backend, não por este cliente). */
export async function listClasses(unitId: string): Promise<ListClassesResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/classes`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ClassWire[]
  return { ok: true, classes: body.map(fromWire) }
}

/** Corpo de PATCH /classes/{id} (BEAC-1901, sheet ⚙️ de T2: "editar dados,
 * trocar professor, trocar quadra, alterar horário") — todo campo é
 * opcional, um PATCH que só manda um não apaga os demais (mesmo contrato do
 * handler real, ver PatchRequest em api/internal/classes/handler.go). */
export interface PatchClassPayload {
  teacherId?: string
  courtId?: string
  name?: string
  startTime?: string
  endTime?: string
  capacity?: number
  level?: string
}

function toPatchWireBody(payload: PatchClassPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (payload.teacherId !== undefined) body.teacher_id = payload.teacherId
  if (payload.courtId !== undefined) body.court_id = payload.courtId
  if (payload.name !== undefined) body.name = payload.name
  if (payload.startTime !== undefined) body.start_time = payload.startTime
  if (payload.endTime !== undefined) body.end_time = payload.endTime
  if (payload.capacity !== undefined) body.capacity = payload.capacity
  if (payload.level !== undefined) body.level = payload.level
  return body
}

export interface PatchClassSuccess {
  ok: true
  rallyeClass: RallyeClass
}

export type PatchClassResult = PatchClassSuccess | ApiFailure

/** PATCH /classes/{id} — edita professor/quadra/nome/horário/capacidade/
 * nível (qualquer subconjunto). Um 403 aqui significa que o chamador não tem
 * permission write em 'agenda' — a tela deve esconder as ações de edição
 * para esse caso, nunca mostrá-las desabilitadas (usePermission.ts,
 * "esconder sempre, nunca desabilitar"). Resposta não tem teacher_name/
 * court_name (só GET /units/{id}/classes enriquece via JOIN) — quem chama
 * precisa mesclar com o RallyeClass já carregado da lista se precisar
 * mostrar nomes atualizados sem re-buscar a lista inteira. */
export async function patchClass(
  classId: string,
  payload: PatchClassPayload,
): Promise<PatchClassResult> {
  const response = await apiFetch(`/classes/${encodeURIComponent(classId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toPatchWireBody(payload)),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ClassWire
  return { ok: true, rallyeClass: fromWire(body) }
}

export interface DeactivateClassSuccess {
  ok: true
  rallyeClass: RallyeClass
}

export type DeactivateClassResult = DeactivateClassSuccess | ApiFailure

/** DELETE /classes/{id} (BEAC-1901, sheet ⚙️ "Desativar turma") —
 * desativação lógica (status vira 'inactive'; o backend cancela as
 * ocorrências futuras já materializadas). */
export async function deactivateClass(classId: string): Promise<DeactivateClassResult> {
  const response = await apiFetch(`/classes/${encodeURIComponent(classId)}`, { method: 'DELETE' })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as ClassWire
  return { ok: true, rallyeClass: fromWire(body) }
}
