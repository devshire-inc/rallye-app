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

// ---------------------------------------------------------------------------
// POST /units/{id}/teachers — cadastro + convite (BEAC-1874/PR3 modo criar).
// Mesmo contrato de 3 cenários de src/lib/api/students.ts createStudent (ver
// comentário de módulo lá) — reproduzido aqui deliberadamente não
// compartilhado entre pacotes, mesma convenção do backend
// (api/internal/teachers/handler.go vs. api/internal/students/handler.go).
// ---------------------------------------------------------------------------

export interface InviteChannelsPayload {
  email: boolean
  whatsapp: boolean
}

export interface CreateTeacherPayload {
  fullName: string
  email: string
  phone?: string
  remunerationModel: RemunerationModel
  remunerationValue: number
  sports: string[]
  certifications?: string
  bio?: string
  inviteChannels: InviteChannelsPayload
  confirmExistingAccount?: boolean
}

export interface CreateTeacherCreated {
  ok: true
  kind: 'created'
  teacherId: string
  status: string
  inviteSentVia: string[]
}

export interface CreateTeacherMembershipCreated {
  ok: true
  kind: 'membership_created'
  email: string
}

export type CreateTeacherSuccess = CreateTeacherCreated | CreateTeacherMembershipCreated

export interface CreateTeacherAccountExists {
  ok: false
  status: 409
  error: 'account_exists'
  message: string
  email: string
}

export interface CreateTeacherAlreadyRegistered {
  ok: false
  status: 409
  error: 'already_registered'
  message: string
}

export interface CreateTeacherGenericFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type CreateTeacherFailure =
  | CreateTeacherAccountExists
  | CreateTeacherAlreadyRegistered
  | CreateTeacherGenericFailure

export type CreateTeacherResult = CreateTeacherSuccess | CreateTeacherFailure

function toCreateWireBody(payload: CreateTeacherPayload): Record<string, unknown> {
  return {
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    remuneration_model: payload.remunerationModel,
    remuneration_value: payload.remunerationValue,
    sports: payload.sports,
    certifications: payload.certifications,
    bio: payload.bio,
    invite_channels: { email: payload.inviteChannels.email, whatsapp: payload.inviteChannels.whatsapp },
    confirm_existing_account: payload.confirmExistingAccount ?? false,
  }
}

/** POST /units/{id}/teachers — cadastra professor e convida (ver comentário de módulo). */
export async function createTeacher(
  unitId: string,
  payload: CreateTeacherPayload,
): Promise<CreateTeacherResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/teachers`, {
    method: 'POST',
    body: JSON.stringify(toCreateWireBody(payload)),
  })

  const body = await response.json().catch(() => ({}))

  if (response.ok) {
    if (body.membership_created === true) {
      return { ok: true, kind: 'membership_created', email: body.email ?? payload.email }
    }
    return {
      ok: true,
      kind: 'created',
      teacherId: body.teacher_id,
      status: body.status,
      inviteSentVia: body.invite_sent_via ?? [],
    }
  }

  if (response.status === 409 && body.error === 'account_exists') {
    return {
      ok: false,
      status: 409,
      error: 'account_exists',
      message: body.message ?? 'Já existe uma conta com este e-mail.',
      email: body.email ?? payload.email,
    }
  }
  if (response.status === 409 && body.error === 'already_registered') {
    return {
      ok: false,
      status: 409,
      error: 'already_registered',
      message: body.message ?? 'Este e-mail já está cadastrado nesta unidade.',
    }
  }

  return { ok: false, status: response.status, error: body.error ?? 'unknown_error', message: body.message }
}

// ---------------------------------------------------------------------------
// PATCH /teachers/{id} — edição de dados básicos (BEAC-1875/PR3 modo editar).
// NÃO inclui e-mail (imutável) nem remuneração (endpoint próprio, ver
// src/lib/api/remuneration.ts) — ver comentário de pacote do handler real
// (rallye-api/api/internal/teachers/patch_handler.go).
// ---------------------------------------------------------------------------

export interface PatchTeacherPayload {
  fullName: string
  phone?: string
  sports: string[]
  certifications?: string
  bio?: string
}

export type PatchTeacherResult = GetTeacherSuccess | ApiFailure

/** PATCH /teachers/{id}. */
export async function patchTeacher(
  teacherId: string,
  payload: PatchTeacherPayload,
): Promise<PatchTeacherResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      full_name: payload.fullName,
      phone: payload.phone,
      sports: payload.sports,
      certifications: payload.certifications,
      bio: payload.bio,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as TeacherWire
  return { ok: true, teacher: fromWire(body) }
}
