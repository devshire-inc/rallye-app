// Cliente HTTP desta story (BEAC-1718 — "Botão 'Desistiu' na aba Inscritos
// (TO3)"). Nome do arquivo travado pelo Orchestrator para não colidir com os
// clientes das stories irmãs do Épico 8 rodando em paralelo (BEAC-1716/
// BEAC-1717/BEAC-1719, cada uma com o seu próprio src/lib/api/tournaments*.ts).
//
// GET /tournaments/{id} e GET /tournament-categories/{id}/registrations NÃO
// usam apiFetch, de propósito: são as duas leituras que a Info/Inscritos de
// TO3 precisa fazer mesmo para um visitante sem sessão nenhuma (AC
// "visitante acessa sem conta, view-only") ou com a sessão temporária de
// BEAC-1820 (sempre sem memberships, ver api/internal/authhttp/visitor.go no
// backend) — nenhum dos dois casos tem autorização real hoje pra estes
// endpoints (todos exigem session.Middleware + TenantContext, que rejeita os
// dois: 401 sem sessão nenhuma, 409 arena_selection_required pra sessão
// temporária sem membership; gap conhecido e aceito, documentado no próprio
// backend em api/internal/tournaments/registrations.go/BEAC-1991 — esta story
// não resolve isso, só não pode deixar que ele quebre a tela). apiFetch
// (httpClient.ts) trataria qualquer 401 não resolvido por refresh como
// sessão expirada e dispararia o redirect global pra /login
// (SESSION_EXPIRED_EVENT, ver App.tsx) — o que sequestraria a navegação de um
// visitante genuíno pra fora da tela, quebrando exatamente o AC "não quebra a
// tela". Por isso este arquivo replica só o necessário de apiFetch (bearer
// token no mobile) sem o interceptor de refresh/redirect — mesmo padrão já
// usado por src/lib/api.ts pros fluxos pré-login (verifyEmail,
// requestVisitorCode etc.). withdrawRegistration (ação exclusiva de Admin já
// autenticado, nunca chamada por um visitante) usa apiFetch normalmente.
import { apiFetch, buildHeaders } from '../httpClient'

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

// Headers idênticos aos do apiFetch (bearer no mobile + `X-Rallye-Unit`),
// via o MESMO `buildHeaders` — as duas leituras abaixo são escopadas por
// arena no backend, é de lá que vem o `409 arena_selection_required` citado
// no comentário de topo. O que este helper dispensa é só o interceptor de
// refresh/401->redirect, nunca os headers.
async function visitorSafeGet(path: string): Promise<Response> {
  return fetch(apiBaseUrl() + path, { credentials: 'include', headers: await buildHeaders() })
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

// ---------------------------------------------------------------------------
// GET /tournaments/{id}
// ---------------------------------------------------------------------------

export type TournamentType = 'fechado' | 'aberto' | 'inter_arenas' | 'externo'
export type TournamentStatus = 'rascunho' | 'publicado' | 'em_andamento' | 'encerrado'

export interface TournamentCategory {
  id: string
  tournamentId: string
  name: string
  maxParticipants: number
}

export interface TournamentDetail {
  id: string
  unitId: string
  name: string
  sport: string
  type: TournamentType
  startDate: string
  endDate: string
  courtIds: string[]
  rules: string | null
  status: TournamentStatus
  entryFee: number
  categories: TournamentCategory[]
}

type TournamentCategoryWire = {
  id: string
  tournament_id: string
  name: string
  max_participants: number
}

type TournamentDetailWire = {
  id: string
  unit_id: string
  name: string
  sport: string
  type: TournamentType
  start_date: string
  end_date: string
  court_ids: string[] | null
  rules: string | null
  status: TournamentStatus
  entry_fee: number
  categories: TournamentCategoryWire[]
}

function categoryFromWire(wire: TournamentCategoryWire): TournamentCategory {
  return {
    id: wire.id,
    tournamentId: wire.tournament_id,
    name: wire.name,
    maxParticipants: wire.max_participants,
  }
}

function detailFromWire(wire: TournamentDetailWire): TournamentDetail {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    name: wire.name,
    sport: wire.sport,
    type: wire.type,
    startDate: wire.start_date,
    endDate: wire.end_date,
    courtIds: wire.court_ids ?? [],
    rules: wire.rules,
    status: wire.status,
    entryFee: wire.entry_fee,
    categories: (wire.categories ?? []).map(categoryFromWire),
  }
}

export interface GetTournamentSuccess {
  ok: true
  tournament: TournamentDetail
}

export type GetTournamentResult = GetTournamentSuccess | ApiFailure

/** GET /tournaments/{id} — dados do torneio + categorias. Visitor-safe (ver
 * comentário de topo do arquivo): uma resposta não-ok aqui (401 anônimo, 409
 * sessão temporária, 404 torneio inexistente/rascunho) deve ser tratada pela
 * UI como "dados do torneio indisponíveis agora", nunca lançada/quebrando a
 * tela. */
export async function getTournament(tournamentId: string): Promise<GetTournamentResult> {
  const response = await visitorSafeGet(`/tournaments/${encodeURIComponent(tournamentId)}`)
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as TournamentDetailWire
  return { ok: true, tournament: detailFromWire(body) }
}

// ---------------------------------------------------------------------------
// GET /tournament-categories/{id}/registrations (BEAC-1991)
// ---------------------------------------------------------------------------

export type RegistrationStatus = 'pending_payment' | 'confirmed' | 'withdrawn'

export interface TournamentRegistration {
  id: string
  categoryId: string
  player1Id: string
  player2Id: string | null
  player2ManualName: string | null
  player2ManualEmail: string | null
  status: RegistrationStatus
  invoiceId: string | null
}

type RegistrationWire = {
  id: string
  category_id: string
  player1_id: string
  player2_id: string | null
  player2_manual_name: string | null
  player2_manual_email: string | null
  status: RegistrationStatus
  invoice_id: string | null
}

function registrationFromWire(wire: RegistrationWire): TournamentRegistration {
  return {
    id: wire.id,
    categoryId: wire.category_id,
    player1Id: wire.player1_id,
    player2Id: wire.player2_id,
    player2ManualName: wire.player2_manual_name,
    player2ManualEmail: wire.player2_manual_email,
    status: wire.status,
    invoiceId: wire.invoice_id,
  }
}

export interface ListRegistrationsSuccess {
  ok: true
  registrations: TournamentRegistration[]
}

export type ListRegistrationsResult = ListRegistrationsSuccess | ApiFailure

/** GET /tournament-categories/{id}/registrations — inscrições de UMA
 * categoria (id de categoria, não de torneio). Visitor-safe, mesmo raciocínio
 * de getTournament acima. */
export async function listCategoryRegistrations(
  categoryId: string,
): Promise<ListRegistrationsResult> {
  const response = await visitorSafeGet(
    `/tournament-categories/${encodeURIComponent(categoryId)}/registrations`,
  )
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { registrations: RegistrationWire[] }
  return { ok: true, registrations: (body.registrations ?? []).map(registrationFromWire) }
}

// ---------------------------------------------------------------------------
// POST /tournament-registrations/{id}/withdraw (BEAC-1992)
// ---------------------------------------------------------------------------

export type WithdrawRefundType = 'total' | 'parcial' | 'nenhum'

export interface WithdrawRegistrationSuccess {
  ok: true
  status: string
}

export interface WithdrawRegistrationFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type WithdrawRegistrationResult = WithdrawRegistrationSuccess | WithdrawRegistrationFailure

/** POST /tournament-registrations/{id}/withdraw — `{id}` nomeia a
 * INSCRIÇÃO. `amount` só é enviado (e exigido pelo backend) quando
 * refundType='parcial' — mesmo contrato de invoices.refundInvoice, que este
 * endpoint reaproveita internamente (decisão travada da story, ver
 * withdraw.go). Ação exclusiva de Admin (torneios:write) — nunca chamada por
 * um visitante, por isso usa apiFetch normalmente (sem o cuidado
 * visitor-safe dos dois clientes de leitura acima). */
export async function withdrawRegistration(
  registrationId: string,
  refundType: WithdrawRefundType,
  amount?: number,
): Promise<WithdrawRegistrationResult> {
  const response = await apiFetch(
    `/tournament-registrations/${encodeURIComponent(registrationId)}/withdraw`,
    {
      method: 'POST',
      body: JSON.stringify(
        refundType === 'parcial' ? { refund_type: refundType, amount } : { refund_type: refundType },
      ),
    },
  )

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'unknown_error',
      message: body.message,
    }
  }
  return { ok: true, status: body.status }
}
