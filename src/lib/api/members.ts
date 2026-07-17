// Cliente HTTP de GET/PATCH /units/{id}/members(/{membership_id}) (BEAC-1844,
// story BEAC-1686: "Aba Papéis em C3: atribuição de papel a usuário"). Usa
// apiFetch (não fetch cru) — mesmo padrão de src/lib/api/units.ts: endpoint
// autenticado por sessão, apiFetch injeta cookie/Authorization e aplica o
// interceptor de refresh-on-401 (BEAC-1793).
import { apiFetch } from '../httpClient'

/** `email` é o valor real de public.profiles.email (ver
 * api/internal/members/handler.go e migrations/000018_profiles_email.up.sql
 * no backend — correção de review de BEAC-1844/BEAC-1845 que resolveu o gap
 * originalmente documentado aqui). Continua tipado como `string | null`
 * porque profiles pré-existentes à migration 000018, sem correspondência em
 * auth.users no momento do backfill, podem não ter email preenchido — a UI
 * ainda precisa lidar com esse caso (ex.: não quebrar ao renderizar um
 * membro sem e-mail). */
export interface MemberRole {
  id: string
  name: string
}

export interface Member {
  membershipId: string
  user: {
    id: string
    name: string
    email: string | null
    avatarUrl: string | null
  }
  role: MemberRole | null
}

type MemberWire = {
  membership_id: string
  user: {
    id: string
    name: string
    email: string | null
    avatar_url: string | null
  }
  role: { id: string; name: string } | null
}

function fromWire(wire: MemberWire): Member {
  return {
    membershipId: wire.membership_id,
    user: {
      id: wire.user.id,
      name: wire.user.name,
      email: wire.user.email,
      avatarUrl: wire.user.avatar_url,
    },
    role: wire.role,
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

export interface ListMembersSuccess {
  ok: true
  members: Member[]
}

export type ListMembersResult = ListMembersSuccess | ApiFailure

/**
 * GET /units/{id}/members — memberships ativas da unit, com dados de perfil
 * do usuário e o papel atual. `query` filtra por nome OU e-mail (ver
 * comentário de pacote acima e no backend).
 */
export async function listMembers(unitId: string, query?: string): Promise<ListMembersResult> {
  const qs = query && query.trim() !== '' ? `?q=${encodeURIComponent(query.trim())}` : ''
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/members${qs}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { members: MemberWire[] }
  return { ok: true, members: body.members.map(fromWire) }
}

export interface PatchMemberRoleSuccess {
  ok: true
  member: Member
}

export type PatchMemberRoleResult = PatchMemberRoleSuccess | ApiFailure

/**
 * PATCH /units/{id}/members/{membership_id} — troca o papel de um membro.
 * O backend registra uma entrada de auditoria (papel anterior -> novo,
 * quem, quando) — este cliente só expõe o resultado da troca em si.
 */
export async function patchMemberRole(
  unitId: string,
  membershipId: string,
  roleId: string,
): Promise<PatchMemberRoleResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/members/${encodeURIComponent(membershipId)}`,
    { method: 'PATCH', body: JSON.stringify({ role_id: roleId }) },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as MemberWire
  return { ok: true, member: fromWire(body) }
}
