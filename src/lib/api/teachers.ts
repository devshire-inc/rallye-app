// Cliente HTTP de GET /units/{id}/teachers (lista, BEAC-1880/PR1) e GET
// /teachers/{id} (detalhe, BEAC-1880/PR2) — rallye-api/api/internal/teachers.
// Mesmo padrão de src/lib/api/students.ts: usa apiFetch, não fetch cru.
//
// Contrato lido diretamente dos handlers reais (list_handler.go/
// get_handler.go): sports[] é o agregado de public.teacher_sports;
// turmas_count (só na listagem) é a contagem de public.classes ATIVAS do
// professor; certifications/bio só aparecem no detalhe (GET /teachers/{id}),
// não na listagem.
import { apiFetch } from '../httpClient'

export type RemunerationModel = 'fixed' | 'per_class' | 'commission'
export type TeacherStatus = 'pending' | 'active' | 'inactive'

export interface TeacherListItem {
  id: string
  fullName: string
  email: string
  phone: string | null
  sports: string[]
  remunerationModel: RemunerationModel
  remunerationValue: number
  status: TeacherStatus
  turmasCount: number
}

type TeacherListItemWire = {
  id: string
  full_name: string
  email: string
  phone: string | null
  sports: string[]
  remuneration_model: RemunerationModel
  remuneration_value: number
  status: TeacherStatus
  turmas_count: number
}

function fromListWire(wire: TeacherListItemWire): TeacherListItem {
  return {
    id: wire.id,
    fullName: wire.full_name,
    email: wire.email,
    phone: wire.phone,
    sports: wire.sports,
    remunerationModel: wire.remuneration_model,
    remunerationValue: wire.remuneration_value,
    status: wire.status,
    turmasCount: wire.turmas_count,
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

export interface ListTeachersSuccess {
  ok: true
  teachers: TeacherListItem[]
}

export type ListTeachersResult = ListTeachersSuccess | ApiFailure

/** GET /units/{id}/teachers — lista os professores da unit, com busca
 * opcional (case-insensitive) por nome. */
export async function listTeachers(unitId: string, search?: string): Promise<ListTeachersResult> {
  const query = search && search.trim() !== '' ? `?search=${encodeURIComponent(search.trim())}` : ''
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/teachers${query}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as TeacherListItemWire[]
  return { ok: true, teachers: body.map(fromListWire) }
}

export interface Teacher {
  id: string
  fullName: string
  email: string
  phone: string | null
  sports: string[]
  remunerationModel: RemunerationModel
  remunerationValue: number
  certifications: string | null
  bio: string | null
  status: TeacherStatus
}

type TeacherWire = {
  id: string
  full_name: string
  email: string
  phone: string | null
  sports: string[]
  remuneration_model: RemunerationModel
  remuneration_value: number
  certifications: string | null
  bio: string | null
  status: TeacherStatus
}

function fromWire(wire: TeacherWire): Teacher {
  return {
    id: wire.id,
    fullName: wire.full_name,
    email: wire.email,
    phone: wire.phone,
    sports: wire.sports,
    remunerationModel: wire.remuneration_model,
    remunerationValue: wire.remuneration_value,
    certifications: wire.certifications,
    bio: wire.bio,
    status: wire.status,
  }
}

export interface GetTeacherSuccess {
  ok: true
  teacher: Teacher
}

export type GetTeacherResult = GetTeacherSuccess | ApiFailure

/** GET /teachers/{id} — detalhe de um professor (header de PR2 + aba Bio). */
export async function getTeacher(teacherId: string): Promise<GetTeacherResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as TeacherWire
  return { ok: true, teacher: fromWire(body) }
}
