// Cliente HTTP de /units/{id}/students(/{studentId}) — cadastro (BEAC-1858,
// story BEAC-1688 "Formulário de cadastro de aluno com responsável legal")
// e leitura por id (BEAC-1872, mesma story — endpoint criado depois, para
// atender ao consumidor já implementado em BEAC-1871/StudentProfilePage).
// Mesmo padrão de src/lib/api/roles.ts: usa apiFetch (não fetch cru) —
// endpoints autenticados por sessão, unit-scoped.
//
// O contrato de criação abaixo segue o handler REAL escrito para esta story
// (api/internal/students/handler.go, rallye-api), não a descrição original
// da task (que previa criar membership no cadastro de e-mail novo — gap
// resolvido, ver comentário de pacote do handler: memberships só nascem no
// resgate do convite, BEAC-1807, nunca aqui):
//
//   - e-mail novo: 201 com { student_id, status: 'pending', invite_sent_via }
//   - e-mail existente sem membership ativa, SEM confirm_existing_account:
//     409 { error: 'account_exists', message, email } — sinal para a UI
//     mostrar o banner e reenviar com confirmExistingAccount=true
//   - e-mail existente sem membership ativa, COM confirm_existing_account:
//     201 com { membership_created: true, email }
//   - e-mail existente COM membership ativa: 409 { error:
//     'already_registered', message }
//
// O contrato de leitura (GET) espelha exatamente os campos disponíveis nas
// tabelas reais (public.profiles: full_name/phone/email; public.students:
// birth_date/cpf/observations/status — ver migrations 000002/000019/000021
// do rallye-api): NÃO inclui nível/esportes (isso vem de
// GET /students/{id}/skill-levels, BEAC-1853, um recurso à parte — ver
// ../api/skillLevels.ts) nem "Inadimplente" como status (public.students.status
// só modela pending/active/inactive; inadimplência é conceito financeiro de
// uma feature futura, BEAC-1632, ainda não implementada).
import { apiFetch } from '../httpClient'

// ---------------------------------------------------------------------------
// POST /units/{id}/students — cadastro + convite (BEAC-1858)
// ---------------------------------------------------------------------------

export interface GuardianPayload {
  nome: string
  telefone: string
  cpf?: string
}

export interface InviteChannelsPayload {
  email: boolean
  whatsapp: boolean
}

export interface CreateStudentPayload {
  fullName: string
  email: string
  phone?: string
  birthDate?: string
  cpf?: string
  observations?: string
  guardian?: GuardianPayload
  inviteChannels: InviteChannelsPayload
  /** true na segunda chamada, depois que o admin confirmou o banner "conta
   * já existe" (ver comentário de módulo). Omitido (false) na primeira. */
  confirmExistingAccount?: boolean
}

export interface CreateStudentCreated {
  ok: true
  kind: 'created'
  studentId: string
  status: string
  inviteSentVia: string[]
}

export interface CreateStudentMembershipCreated {
  ok: true
  kind: 'membership_created'
  email: string
}

export type CreateStudentSuccess = CreateStudentCreated | CreateStudentMembershipCreated

export interface CreateStudentAccountExists {
  ok: false
  status: 409
  error: 'account_exists'
  message: string
  email: string
}

export interface CreateStudentAlreadyRegistered {
  ok: false
  status: 409
  error: 'already_registered'
  message: string
}

export interface CreateStudentGenericFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type CreateStudentFailure =
  | CreateStudentAccountExists
  | CreateStudentAlreadyRegistered
  | CreateStudentGenericFailure

export type CreateStudentResult = CreateStudentSuccess | CreateStudentFailure

function toWireBody(payload: CreateStudentPayload): Record<string, unknown> {
  return {
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    birth_date: payload.birthDate,
    cpf: payload.cpf,
    observations: payload.observations,
    guardian: payload.guardian
      ? { nome: payload.guardian.nome, telefone: payload.guardian.telefone, cpf: payload.guardian.cpf }
      : undefined,
    invite_channels: { email: payload.inviteChannels.email, whatsapp: payload.inviteChannels.whatsapp },
    confirm_existing_account: payload.confirmExistingAccount ?? false,
  }
}

/** POST /units/{id}/students — cadastra aluno e convida (ver comentário de módulo). */
export async function createStudent(
  unitId: string,
  payload: CreateStudentPayload,
): Promise<CreateStudentResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/students`, {
    method: 'POST',
    body: JSON.stringify(toWireBody(payload)),
  })

  const body = await response.json().catch(() => ({}))

  if (response.ok) {
    if (body.membership_created === true) {
      return { ok: true, kind: 'membership_created', email: body.email ?? payload.email }
    }
    return {
      ok: true,
      kind: 'created',
      studentId: body.student_id,
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
// GET /units/{id}/students/{studentId} — leitura por id (BEAC-1872)
// ---------------------------------------------------------------------------

/** Espelha o CHECK de public.students.status (migrations/000021) — sem
 * 'Inadimplente' (não existe no schema atual). */
export type StudentStatus = 'pending' | 'active' | 'inactive'

export interface Student {
  id: string
  fullName: string
  email: string
  phone: string | null
  /** ISO 'AAAA-MM-DD' — null quando não informado (campo opcional no
   * cadastro, ver migrations/000021). */
  birthDate: string | null
  cpf: string | null
  observations: string | null
  status: StudentStatus
}

type StudentWire = {
  id: string
  full_name: string
  email: string
  phone: string | null
  birth_date: string | null
  cpf: string | null
  observations: string | null
  status: StudentStatus
}

function fromWire(wire: StudentWire): Student {
  return {
    id: wire.id,
    fullName: wire.full_name,
    email: wire.email,
    phone: wire.phone,
    birthDate: wire.birth_date,
    cpf: wire.cpf,
    observations: wire.observations,
    status: wire.status,
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

export interface GetStudentSuccess {
  ok: true
  student: Student
}

export type GetStudentResult = GetStudentSuccess | ApiFailure

/** GET /units/{id}/students/{studentId}. */
export async function getStudent(unitId: string, studentId: string): Promise<GetStudentResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/students/${encodeURIComponent(studentId)}`,
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as StudentWire
  return { ok: true, student: fromWire(body) }
}
