// Cliente HTTP de inscrição em torneio (BEAC-1717, story "Sugestão de
// categoria com base no nível de habilidade (TO4)") — rallye-api/api/internal/
// tournaments. Mesmo padrão de src/lib/api/invoices.ts: usa apiFetch, não
// fetch cru; tipos wire (snake_case) convertidos pra camelCase na borda.
//
// getTournament (GET /tournaments/{id}) devolve o torneio + catálogo de
// categorias (nome, tier, gênero, modalidade, max_participants) — é a fonte
// do dropdown de categoria da TO4. Decisão confirmada com o usuário: o
// dropdown NÃO mostra vagas ao vivo (nenhum endpoint em escopo desta story
// expõe ocupação de forma correta para um chamador sem torneios:read — ver
// tournaments/registrations.go no backend, que restringe esse caso às
// próprias inscrições do chamador). Categoria lotada só é conhecida ao
// tentar inscrever (409 category_full, ver registerForCategory abaixo),
// nunca desabilitada de antemão no <select>.
import { apiFetch } from '../httpClient'

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

// ---------------------------------------------------------------------------
// GET /tournaments/{id} — torneio + categorias
// ---------------------------------------------------------------------------

export type CategoryModality = 'individual' | 'duplas'

export interface TournamentCategory {
  id: string
  name: string
  skillTier: string | null
  genderScope: string
  modality: CategoryModality
  maxParticipants: number
}

export interface Tournament {
  id: string
  name: string
  entryFee: number
  categories: TournamentCategory[]
}

type TournamentCategoryWire = {
  id: string
  name: string
  skill_tier: string | null
  gender_scope: string
  modality: CategoryModality
  max_participants: number
}

type TournamentWire = {
  id: string
  name: string
  entry_fee: number
  categories: TournamentCategoryWire[]
}

function fromCategoryWire(wire: TournamentCategoryWire): TournamentCategory {
  return {
    id: wire.id,
    name: wire.name,
    skillTier: wire.skill_tier,
    genderScope: wire.gender_scope,
    modality: wire.modality,
    maxParticipants: wire.max_participants,
  }
}

export interface GetTournamentSuccess {
  ok: true
  tournament: Tournament
}

export type GetTournamentResult = GetTournamentSuccess | ApiFailure

/** GET /tournaments/{id} — usado aqui só para nome/taxa/categorias; demais
 * campos do torneio (datas, quadras, status etc.) não interessam à TO4. */
export async function getTournament(tournamentId: string): Promise<GetTournamentResult> {
  const response = await apiFetch(`/tournaments/${encodeURIComponent(tournamentId)}`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as TournamentWire
  return {
    ok: true,
    tournament: {
      id: body.id,
      name: body.name,
      entryFee: body.entry_fee,
      categories: body.categories.map(fromCategoryWire),
    },
  }
}

// ---------------------------------------------------------------------------
// GET /tournaments/{id}/suggested-category (BEAC-1988)
// ---------------------------------------------------------------------------

export interface SuggestedCategory {
  categoryId: string | null
  categoryName: string | null
  /** Sempre presente — explica a sugestão OU por que não há uma (nunca um
   * erro, ver api/internal/tournaments/suggested_category.go). */
  reason: string
}

type SuggestedCategoryWire = {
  category_id: string | null
  category_name?: string | null
  reason: string
}

export interface GetSuggestedCategorySuccess {
  ok: true
  suggestion: SuggestedCategory
}

export type GetSuggestedCategoryResult = GetSuggestedCategorySuccess | ApiFailure

/** GET /tournaments/{id}/suggested-category — sugestão NUNCA obrigatória:
 * category_id/category_name nil (aqui, null) é um resultado válido, não um
 * erro de chamada. */
export async function getSuggestedCategory(
  tournamentId: string,
): Promise<GetSuggestedCategoryResult> {
  const response = await apiFetch(
    `/tournaments/${encodeURIComponent(tournamentId)}/suggested-category`,
  )
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as SuggestedCategoryWire
  return {
    ok: true,
    suggestion: {
      categoryId: body.category_id,
      categoryName: body.category_name ?? null,
      reason: body.reason,
    },
  }
}

// ---------------------------------------------------------------------------
// POST /tournament-categories/{id}/register (BEAC-1989)
// ---------------------------------------------------------------------------

export type RegistrationStatus = 'confirmed' | 'pending_payment'

export interface RegisterPayload {
  /** profiles.id de um parceiro já cadastrado na plataforma (busca por
   * membro da unit). Mutuamente exclusivo com player2ManualName/Email —
   * ver api/internal/tournaments/register.go. */
  player2Id?: string
  player2ManualName?: string
  player2ManualEmail?: string
}

export interface Registration {
  id: string
  categoryId: string
  player1Id: string
  player2Id: string | null
  player2ManualName: string | null
  player2ManualEmail: string | null
  status: RegistrationStatus
  invoiceId: string | null
  createdAt: string
}

type RegistrationWire = {
  id: string
  category_id: string
  player1_id: string
  player2_id?: string | null
  player2_manual_name?: string | null
  player2_manual_email?: string | null
  status: RegistrationStatus
  invoice_id?: string | null
  created_at: string
}

function fromRegistrationWire(wire: RegistrationWire): Registration {
  return {
    id: wire.id,
    categoryId: wire.category_id,
    player1Id: wire.player1_id,
    player2Id: wire.player2_id ?? null,
    player2ManualName: wire.player2_manual_name ?? null,
    player2ManualEmail: wire.player2_manual_email ?? null,
    status: wire.status,
    invoiceId: wire.invoice_id ?? null,
    createdAt: wire.created_at,
  }
}

export interface RegisterSuccess {
  ok: true
  registration: Registration
}

export type RegisterResult = RegisterSuccess | ApiFailure

/**
 * POST /tournament-categories/{id}/register — `categoryId` nomeia a
 * CATEGORIA (não o torneio). player1 é sempre o próprio chamador (esta tela
 * é self-service — inscrição em nome de terceiros, que exigiria
 * torneios:write, está fora do escopo da TO4). AC: categoria lotada -> 409
 * `category_full`; jogador (ou parceiro) já inscrito em outra categoria do
 * mesmo gender_scope neste torneio -> 409 `duplicate_category_type`;
 * categoria grátis confirma na hora (`status: 'confirmed'`, sem invoice);
 * categoria paga cria fatura e fica `pending_payment` (`invoiceId`
 * preenchido, vaga liberada em 24h se não pago — checagem lógica no
 * backend, nenhum polling necessário aqui).
 */
export async function registerForCategory(
  categoryId: string,
  payload: RegisterPayload,
): Promise<RegisterResult> {
  const response = await apiFetch(
    `/tournament-categories/${encodeURIComponent(categoryId)}/register`,
    {
      method: 'POST',
      body: JSON.stringify({
        player2_id: payload.player2Id,
        player2_manual_name: payload.player2ManualName,
        player2_manual_email: payload.player2ManualEmail,
      }),
    },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as RegistrationWire
  return { ok: true, registration: fromRegistrationWire(body) }
}
