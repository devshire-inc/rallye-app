// Cliente HTTP de public.tournaments (BEAC-1982/BEAC-1983, story BEAC-1716
// — "CRUD de torneio (categorias, datas, quadras)") — rallye-api/api/internal
// /tournaments. Mesmo padrão de src/lib/api/invoices.ts: usa apiFetch, não
// fetch cru; tipos wire (snake_case) convertidos pra camelCase na borda.
//
// Cobre os 6 endpoints já mergeados em develop (ver api/cmd/server/main.go e
// o comentário de pacote de api/internal/tournaments/shared.go pro contrato
// exato): criar, buscar, editar dados básicos, editar categorias, editar
// pontuação de ranking e publicar. NÃO existe endpoint de listagem
// (GET /units/{id}/tournaments ou GET /tournaments) neste backend ainda —
// gap confirmado lendo o roteamento real, não uma omissão deste cliente.
import { apiFetch } from '../httpClient'

/** Espelha sportsCatalog (tournaments/shared.go) — mesmo catálogo de
 * src/lib/sports.ts. */
export type TournamentSport = 'beach_tennis' | 'padel' | 'futevolei' | 'volei'

/** Espelha tournamentTypes (tournaments/shared.go). */
export type TournamentType = 'fechado' | 'aberto' | 'inter_arenas' | 'externo'

/** Espelha o CHECK de public.tournaments.status. Torneio sempre nasce
 * 'rascunho' (CreateHandler não aceita status no request). */
export type TournamentStatus = 'rascunho' | 'publicado' | 'em_andamento' | 'encerrado'

/** Espelha bracketFormats (tournaments/shared.go). */
export type BracketFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'swiss'
  | 'groups_knockout'

/** Espelha skillTiers (tournaments/shared.go). */
export type CategorySkillTier = 'pe_na_areia' | 'd' | 'c' | 'b' | 'a' | 'pro_open'

/** Espelha genderScopes (tournaments/shared.go). */
export type CategoryGenderScope = 'masculino' | 'feminino' | 'misto' | 'livre'

/** Espelha modalities (tournaments/shared.go). */
export type CategoryModality = 'duplas' | 'individual'

/** Espelha rankingPlacementDefaults (tournaments/shared.go) — catálogo
 * fechado das 6 colocações semeadas na criação, sem criação/remoção. */
export type RankingPlacement =
  | 'campeao'
  | 'vice'
  | 'terceiro'
  | 'semifinalista'
  | 'quartas'
  | 'participacao'

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

export interface TournamentCategory {
  id: string
  tournamentId: string
  name: string
  skillTier: CategorySkillTier | null
  genderScope: CategoryGenderScope
  modality: CategoryModality
  maxParticipants: number
  bracketFormat: BracketFormat | null
}

type TournamentCategoryWire = {
  id: string
  tournament_id: string
  name: string
  skill_tier: CategorySkillTier | null
  gender_scope: CategoryGenderScope
  modality: CategoryModality
  max_participants: number
  bracket_format: BracketFormat | null
}

function fromCategoryWire(wire: TournamentCategoryWire): TournamentCategory {
  return {
    id: wire.id,
    tournamentId: wire.tournament_id,
    name: wire.name,
    skillTier: wire.skill_tier,
    genderScope: wire.gender_scope,
    modality: wire.modality,
    maxParticipants: wire.max_participants,
    bracketFormat: wire.bracket_format,
  }
}

export interface TournamentRankingRule {
  id: string
  tournamentId: string
  placement: RankingPlacement
  points: number
}

type TournamentRankingRuleWire = {
  id: string
  tournament_id: string
  placement: RankingPlacement
  points: number
}

function fromRankingRuleWire(wire: TournamentRankingRuleWire): TournamentRankingRule {
  return { id: wire.id, tournamentId: wire.tournament_id, placement: wire.placement, points: wire.points }
}

export interface TournamentDetail {
  id: string
  unitId: string
  name: string
  sport: TournamentSport
  type: TournamentType
  startDate: string
  endDate: string
  courtIds: string[]
  bannerUrl: string | null
  rules: string | null
  status: TournamentStatus
  entryFee: number
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  requiresPayment: boolean
  bracketFormat: BracketFormat
  useRankingPoints: boolean
  createdBy: string
  createdAt: string
  categories: TournamentCategory[]
  rankingRules: TournamentRankingRule[]
}

type TournamentDetailWire = {
  id: string
  unit_id: string
  name: string
  sport: TournamentSport
  type: TournamentType
  start_date: string
  end_date: string
  court_ids: string[]
  banner_url: string | null
  rules: string | null
  status: TournamentStatus
  entry_fee: number
  registration_opens_at: string | null
  registration_closes_at: string | null
  requires_payment: boolean
  bracket_format: BracketFormat
  use_ranking_points: boolean
  created_by: string
  created_at: string
  categories: TournamentCategoryWire[]
  ranking_rules: TournamentRankingRuleWire[]
}

function fromTournamentWire(wire: TournamentDetailWire): TournamentDetail {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    name: wire.name,
    sport: wire.sport,
    type: wire.type,
    startDate: wire.start_date,
    endDate: wire.end_date,
    courtIds: wire.court_ids ?? [],
    bannerUrl: wire.banner_url,
    rules: wire.rules,
    status: wire.status,
    entryFee: wire.entry_fee,
    registrationOpensAt: wire.registration_opens_at,
    registrationClosesAt: wire.registration_closes_at,
    requiresPayment: wire.requires_payment,
    bracketFormat: wire.bracket_format,
    useRankingPoints: wire.use_ranking_points,
    createdBy: wire.created_by,
    createdAt: wire.created_at,
    categories: (wire.categories ?? []).map(fromCategoryWire),
    rankingRules: (wire.ranking_rules ?? []).map(fromRankingRuleWire),
  }
}

export interface TournamentSuccess {
  ok: true
  tournament: TournamentDetail
}

export type TournamentResult = TournamentSuccess | ApiFailure

// ---------------------------------------------------------------------------
// POST /units/{id}/tournaments — criar (BEAC-1982)
// ---------------------------------------------------------------------------

export interface CreateTournamentPayload {
  name: string
  sport: TournamentSport
  type: TournamentType
  startDate: string
  endDate: string
  /** Formato de chaveamento default do torneio — obrigatório pelo backend
   * (CreateRequest.BracketFormat), mas sem campo próprio no wizard TO2 (AC
   * não lista "formato de chaveamento" entre os campos do Step 1). Quem
   * chama esta função decide o default (ver DEFAULT_BRACKET_FORMAT em
   * TournamentFormPage.tsx) — não fabricado aqui, só repassado. */
  bracketFormat: BracketFormat
  courtIds?: string[]
  bannerUrl?: string | null
  rules?: string | null
  entryFee?: number
  /** RFC3339 (ex.: 2026-08-20T00:00:00-03:00). */
  registrationOpensAt?: string | null
  /** RFC3339. */
  registrationClosesAt?: string | null
  requiresPayment?: boolean
  useRankingPoints?: boolean
}

/** POST /units/{id}/tournaments — torneio nasce sempre em status=rascunho;
 * o backend já semeia as 6 ranking_rules default (100/70/50/35/20/10, mesmos
 * valores do Step 4 do wizard) e categories=[] na resposta. */
export async function createTournament(
  unitId: string,
  payload: CreateTournamentPayload,
): Promise<TournamentResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/tournaments`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      sport: payload.sport,
      type: payload.type,
      start_date: payload.startDate,
      end_date: payload.endDate,
      bracket_format: payload.bracketFormat,
      court_ids: payload.courtIds ?? [],
      banner_url: payload.bannerUrl ?? null,
      rules: payload.rules ?? null,
      entry_fee: payload.entryFee,
      registration_opens_at: payload.registrationOpensAt,
      registration_closes_at: payload.registrationClosesAt,
      requires_payment: payload.requiresPayment,
      use_ranking_points: payload.useRankingPoints,
    }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentDetailWire
  return { ok: true, tournament: fromTournamentWire(body) }
}

// ---------------------------------------------------------------------------
// GET /tournaments/{id} — buscar (BEAC-1983)
// ---------------------------------------------------------------------------

/** GET /tournaments/{id} — 404 tanto para torneio inexistente/de outra unit
 * quanto para rascunho de outro chamador sem torneios:write (AC: nunca vaza
 * existência). */
export async function getTournament(tournamentId: string): Promise<TournamentResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}`)
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentDetailWire
  return { ok: true, tournament: fromTournamentWire(body) }
}

// ---------------------------------------------------------------------------
// PATCH /tournaments/{id} — editar dados básicos (BEAC-1982)
// ---------------------------------------------------------------------------

export interface PatchTournamentPayload {
  name?: string
  sport?: TournamentSport
  type?: TournamentType
  startDate?: string
  endDate?: string
  bracketFormat?: BracketFormat
  courtIds?: string[]
  bannerUrl?: string | null
  rules?: string | null
  entryFee?: number
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  requiresPayment?: boolean
  useRankingPoints?: boolean
}

/** PATCH /tournaments/{id} — só os campos informados são alterados (mesmo
 * padrão PATCH-parcial de patchPlan/registerManualPayment). */
export async function patchTournament(
  tournamentId: string,
  payload: PatchTournamentPayload,
): Promise<TournamentResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      sport: payload.sport,
      type: payload.type,
      start_date: payload.startDate,
      end_date: payload.endDate,
      bracket_format: payload.bracketFormat,
      court_ids: payload.courtIds,
      banner_url: payload.bannerUrl,
      rules: payload.rules,
      entry_fee: payload.entryFee,
      registration_opens_at: payload.registrationOpensAt,
      registration_closes_at: payload.registrationClosesAt,
      requires_payment: payload.requiresPayment,
      use_ranking_points: payload.useRankingPoints,
    }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentDetailWire
  return { ok: true, tournament: fromTournamentWire(body) }
}

// ---------------------------------------------------------------------------
// PATCH /tournaments/{id}/categories — editar categorias (BEAC-1982)
// ---------------------------------------------------------------------------

export interface CategoryInput {
  /** Presente => atualiza a categoria existente; ausente => cria uma nova
   * (mesmo padrão de plans.VariantInput). */
  id?: string
  name: string
  skillTier?: CategorySkillTier | null
  genderScope: CategoryGenderScope
  modality: CategoryModality
  maxParticipants: number
  bracketFormat?: BracketFormat | null
}

export interface CategoriesSuccess {
  ok: true
  categories: TournamentCategory[]
}

export type CategoriesResult = CategoriesSuccess | ApiFailure

/** PATCH /tournaments/{id}/categories — cria/edita categorias; NÃO remove
 * nenhuma (backend não expõe DELETE /tournament-categories/{id} — confirmado
 * lendo api/cmd/server/main.go, nenhuma rota de remoção existe). Remover uma
 * categoria já persistida no wizard só some do PRÓXIMO payload enviado — a
 * linha continua existindo no banco (gap conhecido, aceito, não inventado,
 * mesmo padrão de "GAP CONHECIDO" documentado em F2InvoiceListPage.tsx). */
export async function patchTournamentCategories(
  tournamentId: string,
  categories: CategoryInput[],
): Promise<CategoriesResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}/categories`, {
    method: 'PATCH',
    body: JSON.stringify({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        skill_tier: c.skillTier ?? null,
        gender_scope: c.genderScope,
        modality: c.modality,
        max_participants: c.maxParticipants,
        bracket_format: c.bracketFormat ?? null,
      })),
    }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentCategoryWire[]
  return { ok: true, categories: body.map(fromCategoryWire) }
}

// ---------------------------------------------------------------------------
// PATCH /tournaments/{id}/ranking-rules — editar pontuação (BEAC-1982)
// ---------------------------------------------------------------------------

export interface RankingRuleInput {
  placement: RankingPlacement
  points: number
}

export interface RankingRulesSuccess {
  ok: true
  rankingRules: TournamentRankingRule[]
}

export type RankingRulesResult = RankingRulesSuccess | ApiFailure

/** PATCH /tournaments/{id}/ranking-rules — upsert por colocação (catálogo
 * fechado de 6 colocações, sem criação/remoção). */
export async function patchTournamentRankingRules(
  tournamentId: string,
  rankingRules: RankingRuleInput[],
): Promise<RankingRulesResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}/ranking-rules`, {
    method: 'PATCH',
    body: JSON.stringify({
      ranking_rules: rankingRules.map((r) => ({ placement: r.placement, points: r.points })),
    }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentRankingRuleWire[]
  return { ok: true, rankingRules: body.map(fromRankingRuleWire) }
}

// ---------------------------------------------------------------------------
// POST /tournaments/{id}/publish — publicar (BEAC-1983)
// ---------------------------------------------------------------------------

/** POST /tournaments/{id}/publish — só rascunho -> publicado (409 em
 * qualquer outra transição). */
export async function publishTournament(tournamentId: string): Promise<TournamentResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}/publish`, {
    method: 'POST',
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentDetailWire
  return { ok: true, tournament: fromTournamentWire(body) }
}
