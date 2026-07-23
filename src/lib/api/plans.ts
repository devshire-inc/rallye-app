// Cliente HTTP de GET/POST /units/{id}/plans, GET /plans/{id} e PATCH
// /plans/{id} (BEAC-1931 + BEAC-1976, story BEAC-1927 — "Planos e
// Assinaturas (PL1-PL5)"): CRUD de plano/pacote consumido pelas telas PL1
// (BEAC-1934, catálogo), PL2 (BEAC-1935, criar/editar) e PL5 (BEAC-1938,
// trocar plano). Mesmo padrão de src/lib/api/classes.ts: usa apiFetch (não
// fetch cru), mapeia snake_case (wire) <-> camelCase.
import { apiFetch } from '../httpClient'

/** Espelha o CHECK de public.plans.type (rallye-api migrations/000047). */
export type PlanType = 'mensalidade' | 'pacote' | 'day_use'

/** Espelha o CHECK de public.plan_variants.billing_cycle. */
export type BillingCycle = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return {
    ok: false,
    status: response.status,
    error: body.error ?? 'unknown_error',
    message: body.message,
  }
}

/** Um plano dentro de um grupo de esporte, em GET /units/{id}/plans (PL1). */
export interface PlanSummary {
  id: string
  name: string
  type: PlanType
  sport: string | null
  maxMembers: number
  isActive: boolean
  variantCount: number
  activeSubscriberCount: number
  /** Menor final_price entre as variantes ativas — "a partir de". `null`
   * quando o plano não tem nenhuma variante ativa. */
  startingPrice: number | null
}

/** Um grupo de planos de um mesmo esporte (PL1: "Agrupados por esporte").
 * `sport === null` = planos sem esporte definido (ex.: família/pacote —
 * ver comentário de PlanGroup no backend, api/internal/plans/handler.go). */
export interface PlanGroupResult {
  sport: string | null
  plans: PlanSummary[]
}

type PlanSummaryWire = {
  id: string
  name: string
  type: PlanType
  sport: string | null
  max_members: number
  is_active: boolean
  variant_count: number
  active_subscriber_count: number
  starting_price: number | null
}

type PlanGroupWire = {
  sport: string | null
  plans: PlanSummaryWire[]
}

function summaryFromWire(wire: PlanSummaryWire): PlanSummary {
  return {
    id: wire.id,
    name: wire.name,
    type: wire.type,
    sport: wire.sport,
    maxMembers: wire.max_members,
    isActive: wire.is_active,
    variantCount: wire.variant_count,
    activeSubscriberCount: wire.active_subscriber_count,
    startingPrice: wire.starting_price,
  }
}

export interface ListPlansSuccess {
  ok: true
  groups: PlanGroupResult[]
}

export type ListPlansResult = ListPlansSuccess | ApiFailure

/** GET /units/{id}/plans (PL1): planos agrupados por esporte, com contagem
 * de variantes/assinantes ativos e o menor preço entre as variantes ativas. */
export async function listPlans(unitId: string): Promise<ListPlansResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/plans`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as PlanGroupWire[]
  return {
    ok: true,
    groups: body.map((g) => ({ sport: g.sport, plans: g.plans.map(summaryFromWire) })),
  }
}

/** Uma variante de recorrência (PL2: "Mensal · R$350/mês", etc). */
export interface PlanVariant {
  id: string
  planId: string
  billingCycle: BillingCycle
  basePrice: number
  discountPercent: number
  finalPrice: number
  sessionsPerWeek: number | null
  totalSessions: number | null
  isActive: boolean
}

type PlanVariantWire = {
  id: string
  plan_id: string
  billing_cycle: BillingCycle
  base_price: number
  discount_percent: number
  final_price: number
  sessions_per_week: number | null
  total_sessions: number | null
  is_active: boolean
}

function variantFromWire(wire: PlanVariantWire): PlanVariant {
  return {
    id: wire.id,
    planId: wire.plan_id,
    billingCycle: wire.billing_cycle,
    basePrice: wire.base_price,
    discountPercent: wire.discount_percent,
    finalPrice: wire.final_price,
    sessionsPerWeek: wire.sessions_per_week,
    totalSessions: wire.total_sessions,
    isActive: wire.is_active,
  }
}

/** Plano completo (com variantes) — devolvido por POST /units/{id}/plans e
 * PATCH /plans/{id}, e usado como estado inicial de edição em PL2. */
export interface PlanDetail {
  id: string
  unitId: string
  name: string
  type: PlanType
  sport: string | null
  maxMembers: number
  description: string | null
  isActive: boolean
  variants: PlanVariant[]
}

type PlanDetailWire = {
  id: string
  unit_id: string
  name: string
  type: PlanType
  sport: string | null
  max_members: number
  description: string | null
  is_active: boolean
  variants: PlanVariantWire[]
}

function detailFromWire(wire: PlanDetailWire): PlanDetail {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    name: wire.name,
    type: wire.type,
    sport: wire.sport,
    maxMembers: wire.max_members,
    description: wire.description,
    isActive: wire.is_active,
    variants: wire.variants.map(variantFromWire),
  }
}

/** Uma variante enviada em POST/PATCH (PL2). `id` presente (só em PATCH)
 * atualiza a variante existente; ausente cria uma nova — mesmo contrato do
 * handler real (VariantInput em api/internal/plans/handler.go). */
export interface PlanVariantPayload {
  id?: string
  billingCycle?: BillingCycle
  basePrice: number
  discountPercent?: number
  sessionsPerWeek?: number | null
  totalSessions?: number | null
  isActive?: boolean
}

function variantToWireBody(v: PlanVariantPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { base_price: v.basePrice }
  if (v.id !== undefined) body.id = v.id
  if (v.billingCycle !== undefined) body.billing_cycle = v.billingCycle
  if (v.discountPercent !== undefined) body.discount_percent = v.discountPercent
  if (v.sessionsPerWeek !== undefined) body.sessions_per_week = v.sessionsPerWeek
  if (v.totalSessions !== undefined) body.total_sessions = v.totalSessions
  if (v.isActive !== undefined) body.is_active = v.isActive
  return body
}

/** Corpo de POST /units/{id}/plans (PL2, criar). */
export interface CreatePlanPayload {
  name: string
  type: PlanType
  sport?: string
  maxMembers?: number
  description?: string
  variants: PlanVariantPayload[]
}

export interface CreatePlanSuccess {
  ok: true
  plan: PlanDetail
}

export type CreatePlanResult = CreatePlanSuccess | ApiFailure

/** POST /units/{id}/plans (PL2, "Salvar plano" em modo criação). */
export async function createPlan(
  unitId: string,
  payload: CreatePlanPayload,
): Promise<CreatePlanResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/plans`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      type: payload.type,
      sport: payload.sport,
      max_members: payload.maxMembers,
      description: payload.description,
      variants: payload.variants.map(variantToWireBody),
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as PlanDetailWire
  return { ok: true, plan: detailFromWire(body) }
}

/** Corpo de PATCH /plans/{id} (PL2, "Salvar plano" em modo edição) — todo
 * campo de topo é opcional (um PATCH que só manda um não apaga os demais,
 * mesmo contrato do handler real). `variants`, quando presente, é a lista
 * completa de variantes a criar/atualizar (nenhuma é apagada por omissão —
 * ver comentário de pacote em api/internal/plans/handler.go). */
export interface PatchPlanPayload {
  name?: string
  type?: PlanType
  sport?: string
  maxMembers?: number
  description?: string
  isActive?: boolean
  variants?: PlanVariantPayload[]
}

export interface PatchPlanSuccess {
  ok: true
  plan: PlanDetail
}

export type PatchPlanResult = PatchPlanSuccess | ApiFailure

export interface GetPlanSuccess {
  ok: true
  plan: PlanDetail
}

export type GetPlanResult = GetPlanSuccess | ApiFailure

/** GET /plans/{id} (BEAC-1976): devolve um único plano com suas variantes,
 * no MESMO formato de resposta de POST/PATCH. Acessível a qualquer membro
 * da unit (não exige nenhuma permission em 'financeiro', ao contrário de
 * POST/PATCH) — é o que PL5 (BEAC-1938, "Trocar Plano") usa pra montar a
 * lista de opções, já que um Aluno comum não tem financeiro:write. */
export async function getPlan(planId: string): Promise<GetPlanResult> {
  const response = await apiFetch(`/plans/${encodeURIComponent(planId)}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as PlanDetailWire
  return { ok: true, plan: detailFromWire(body) }
}

/** GET de um único plano com suas variantes, pro form de edição de PL2
 * (BEAC-1935). Até BEAC-1976 reaproveitava PATCH /plans/{id} com corpo
 * vazio (workaround: nenhuma task de BEAC-1931 tinha criado um GET
 * /plans/{id} dedicado, e PATCH com `{}` não altera nenhum campo — só
 * relê e devolve o plano tal como está) — isso exigia financeiro:write até
 * pra só CARREGAR o form, o que também quebrava PL5 (aluno sem essa
 * permission tentando montar a lista de troca de plano, ver comentário de
 * pacote em PL5ChangePlanPage.tsx). Agora delega a getPlan (GET /plans/{id}
 * dedicado, acessível a qualquer membro) — mantido como função própria
 * (em vez de todo consumidor chamar getPlan diretamente) só pelo nome
 * semântico já usado por PlanoFormPage.tsx/VincularPlanoSheet.tsx. */
export async function getPlanForEdit(planId: string): Promise<GetPlanResult> {
  return getPlan(planId)
}

/** PATCH /plans/{id} — foot-note do protótipo real (PL2): "Editar não afeta
 * assinaturas existentes — só novas" (garantido pelo backend, não por este
 * cliente). */
export async function patchPlan(
  planId: string,
  payload: PatchPlanPayload,
): Promise<PatchPlanResult> {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.type !== undefined) body.type = payload.type
  if (payload.sport !== undefined) body.sport = payload.sport
  if (payload.maxMembers !== undefined) body.max_members = payload.maxMembers
  if (payload.description !== undefined) body.description = payload.description
  if (payload.isActive !== undefined) body.is_active = payload.isActive
  if (payload.variants !== undefined) body.variants = payload.variants.map(variantToWireBody)

  const response = await apiFetch(`/plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!response.ok) return failureFrom(response)

  const responseBody = (await response.json()) as PlanDetailWire
  return { ok: true, plan: detailFromWire(responseBody) }
}
