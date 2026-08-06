// Cliente HTTP de chaves/partidas de torneio (BEAC-2006/2007/2008, story
// BEAC-1719) — rallye-api/api/internal/tournaments. Mesmo padrão de
// src/lib/api/invoices.ts: usa apiFetch, não fetch cru; tipos wire
// (snake_case) convertidos pra camelCase na borda — exceto as 3 leituras
// (listCategoryMatches/getMatch/getTournamentBracketInfo), que usam
// visitorSafeGet por um motivo específico documentado ali embaixo.
//
// BEAC-2012 (endpoints GET pra ler chaveamento/partidas) e BEAC-2011 (relay
// SSE, ver ../../hooks/useTournamentLive.ts) já mergearam em develop e
// resolveram o bloqueio original desta story (não existia nenhum GET pra
// bracket, nem placar de set, nem nome de dupla). registration1Name/
// registration2Name já vêm resolvidos pelo backend — não precisa mais do
// fallback "Jogador #xxxx" via GET /units/{id}/members que TO3 usa.
//
// Nomes de arquivo/tipos travados pelo Orchestrator desde o dispatch
// original desta story, pra não colidir com src/lib/api/tournaments.ts
// (TO2) nem tournamentWithdrawal.ts/tournamentEnrollment.ts (TO3/TO4) —
// mesma convenção de "cada story com seu próprio cliente" já documentada
// no topo de tournamentWithdrawal.ts. getTournamentBracketInfo por isso
// duplica localmente só os campos de categoria que o bracket precisa
// (incluindo bracketFormat/skillTier, que a versão de TO3 não expõe).
import { apiFetch, buildHeaders } from '../httpClient'

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

/** Réplica de apiFetch sem o interceptor de refresh/401->redirect (ver
 * tournamentWithdrawal.ts, mesmo raciocínio): TO5/TO6 precisam continuar
 * legíveis por um visitante sem sessão (AC "visitante vê sem login") —
 * mesmo que hoje isso ainda não seja anônimo de verdade (gap conhecido,
 * documentado em BEAC-1991/BEAC-2012/BEAC-2011: as 3 leituras abaixo ainda
 * exigem sessão no backend), usar apiFetch aqui faria um 401 genuíno de
 * visitante disparar SESSION_EXPIRED_EVENT e redirecionar pra /login,
 * quebrando a tela em vez de mostrar "indisponível".
 *
 * O que ela NÃO replica mais é a montagem dos headers: as 3 leituras abaixo
 * são escopadas por arena no backend (é de lá que vinha o `409
 * arena_selection_required` documentado acima), então precisam do
 * `X-Rallye-Unit` como qualquer outra chamada — e a montagem vem inteira do
 * `buildHeaders` do httpClient, o mesmo que o apiFetch usa. É só o
 * INTERCEPTOR que é dispensado aqui, nunca os headers. */
async function visitorSafeGet(path: string): Promise<Response> {
  return fetch(apiBaseUrl() + path, { credentials: 'include', headers: await buildHeaders() })
}

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
// POST /tournament-matches/{id}/result — registrar resultado (BEAC-2008/TO7)
// ---------------------------------------------------------------------------

export type MatchPhase = 'bracket' | 'group_stage' | 'swiss_round'
export type BracketType = 'winners' | 'losers'
export type MatchStatus = 'pending' | 'completed' | 'walkover'
export type WalkoverSide = 'registration1' | 'registration2'

export interface SetScore {
  registration1Score: number
  registration2Score: number
}

type SetScoreWire = {
  registration1_score: number
  registration2_score: number
}

/** Corpo de POST /tournament-matches/{id}/result — exatamente um de
 * `walkover` ou `sets` deve ser informado (validado pelo backend). */
export type RegisterMatchResultPayload =
  | { walkover: WalkoverSide; sets?: never }
  | { sets: SetScore[]; walkover?: never }

export interface MatchResponse {
  id: string
  categoryId: string
  phase: MatchPhase
  round: number
  bracketType: BracketType | null
  groupId: string | null
  positionInRound: number
  registration1Id: string | null
  registration2Id: string | null
  winnerRegistrationId: string | null
  nextMatchId: string | null
  nextMatchSlot: number | null
  loserNextMatchId: string | null
  status: MatchStatus
  courtId: string | null
  scheduledAt: string | null
  createdAt: string
}

type MatchResponseWire = {
  id: string
  category_id: string
  phase: MatchPhase
  round: number
  bracket_type: BracketType | null
  group_id: string | null
  position_in_round: number
  registration1_id: string | null
  registration2_id: string | null
  winner_registration_id: string | null
  next_match_id: string | null
  next_match_slot: number | null
  loser_next_match_id: string | null
  status: MatchStatus
  court_id: string | null
  scheduled_at: string | null
  created_at: string
}

function fromMatchWire(wire: MatchResponseWire): MatchResponse {
  return {
    id: wire.id,
    categoryId: wire.category_id,
    phase: wire.phase,
    round: wire.round,
    bracketType: wire.bracket_type,
    groupId: wire.group_id,
    positionInRound: wire.position_in_round,
    registration1Id: wire.registration1_id,
    registration2Id: wire.registration2_id,
    winnerRegistrationId: wire.winner_registration_id,
    nextMatchId: wire.next_match_id,
    nextMatchSlot: wire.next_match_slot,
    loserNextMatchId: wire.loser_next_match_id,
    status: wire.status,
    courtId: wire.court_id,
    scheduledAt: wire.scheduled_at,
    createdAt: wire.created_at,
  }
}

export interface RegisterMatchResultSuccess {
  ok: true
  match: MatchResponse
}

export type RegisterMatchResultResult = RegisterMatchResultSuccess | ApiFailure

/** POST /tournament-matches/{id}/result — registra placar ou WO; editável
 * por 24h (senão 409 edit_window_expired), bloqueado se a próxima partida
 * já tem resultado ou o ranking da categoria já fechou (409 result_locked). */
export async function registerMatchResult(
  matchId: string,
  payload: RegisterMatchResultPayload,
): Promise<RegisterMatchResultResult> {
  const body: { walkover?: WalkoverSide; sets?: SetScoreWire[] } =
    'walkover' in payload && payload.walkover
      ? { walkover: payload.walkover }
      : {
          sets: (payload.sets ?? []).map((s) => ({
            registration1_score: s.registration1Score,
            registration2_score: s.registration2Score,
          })),
        }

  const response = await apiFetch(`/tournament-matches/${encodeURIComponent(matchId)}/result`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) return failureFrom(response)

  const wire = (await response.json()) as MatchResponseWire
  return { ok: true, match: fromMatchWire(wire) }
}

// ---------------------------------------------------------------------------
// GET /tournament-categories/{id}/matches e GET /tournament-matches/{id}
// (BEAC-2012) — leitura do bracket, usada por TO5/TO6
// ---------------------------------------------------------------------------

export interface MatchSet {
  setNumber: number
  registration1Score: number
  registration2Score: number
}

type MatchSetWire = {
  set_number: number
  registration1_score: number
  registration2_score: number
}

function fromSetWire(wire: MatchSetWire): MatchSet {
  return {
    setNumber: wire.set_number,
    registration1Score: wire.registration1_score,
    registration2Score: wire.registration2_score,
  }
}

/** MatchResponse + sets + nomes de exibição já resolvidos pelo backend
 * (null quando a vaga da chave ainda não foi preenchida). */
export interface MatchDetailResponse extends MatchResponse {
  sets: MatchSet[]
  registration1Name: string | null
  registration2Name: string | null
}

type MatchDetailResponseWire = MatchResponseWire & {
  sets: MatchSetWire[]
  registration1_name: string | null
  registration2_name: string | null
}

function fromMatchDetailWire(wire: MatchDetailResponseWire): MatchDetailResponse {
  return {
    ...fromMatchWire(wire),
    sets: wire.sets.map(fromSetWire),
    registration1Name: wire.registration1_name,
    registration2Name: wire.registration2_name,
  }
}

export interface ListCategoryMatchesSuccess {
  ok: true
  categoryId: string
  matches: MatchDetailResponse[]
}

export type ListCategoryMatchesResult = ListCategoryMatchesSuccess | ApiFailure

/** GET /tournament-categories/{id}/matches — todas as partidas de uma
 * categoria (para desenhar o bracket/tabela de TO5). Visitor-safe (ver
 * comentário de topo do arquivo) — hoje ainda exige sessão no backend
 * (gap conhecido), mas uma falha aqui não pode sequestrar a navegação de
 * um visitante genuíno. */
export async function listCategoryMatches(categoryId: string): Promise<ListCategoryMatchesResult> {
  const response = await visitorSafeGet(
    `/tournament-categories/${encodeURIComponent(categoryId)}/matches`,
  )
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { category_id: string; matches: MatchDetailResponseWire[] }
  return { ok: true, categoryId: body.category_id, matches: body.matches.map(fromMatchDetailWire) }
}

export interface GetMatchSuccess {
  ok: true
  match: MatchDetailResponse
}

export type GetMatchResult = GetMatchSuccess | ApiFailure

/** GET /tournament-matches/{id} — detalhe de uma partida (TO6), com sets e
 * nomes. Visitor-safe, mesmo raciocínio de listCategoryMatches acima. */
export async function getMatch(matchId: string): Promise<GetMatchResult> {
  const response = await visitorSafeGet(`/tournament-matches/${encodeURIComponent(matchId)}`)
  if (!response.ok) return failureFrom(response)
  const wire = (await response.json()) as MatchDetailResponseWire
  return { ok: true, match: fromMatchDetailWire(wire) }
}

// ---------------------------------------------------------------------------
// GET /tournaments/{id} — só o necessário pro bracket (categorias com
// bracketFormat, pras tabs/rounds de TO5)
// ---------------------------------------------------------------------------

export type BracketFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'swiss'
  | 'groups_knockout'
export type BracketCategorySkillTier = 'pe_na_areia' | 'd' | 'c' | 'b' | 'a' | 'pro_open'
export type BracketCategoryGenderScope = 'masculino' | 'feminino' | 'misto' | 'livre'
export type BracketCategoryModality = 'duplas' | 'individual'
export type TournamentBracketStatus = 'rascunho' | 'publicado' | 'em_andamento' | 'encerrado'

export interface BracketCategory {
  id: string
  name: string
  skillTier: BracketCategorySkillTier | null
  genderScope: BracketCategoryGenderScope
  modality: BracketCategoryModality
  bracketFormat: BracketFormat | null
}

type BracketCategoryWire = {
  id: string
  name: string
  skill_tier: BracketCategorySkillTier | null
  gender_scope: BracketCategoryGenderScope
  modality: BracketCategoryModality
  bracket_format: BracketFormat | null
}

function fromBracketCategoryWire(wire: BracketCategoryWire): BracketCategory {
  return {
    id: wire.id,
    name: wire.name,
    skillTier: wire.skill_tier,
    genderScope: wire.gender_scope,
    modality: wire.modality,
    bracketFormat: wire.bracket_format,
  }
}

export interface TournamentBracketInfo {
  id: string
  name: string
  status: TournamentBracketStatus
  categories: BracketCategory[]
}

type TournamentBracketInfoWire = {
  id: string
  name: string
  status: TournamentBracketStatus
  categories: BracketCategoryWire[]
}

export interface GetTournamentBracketInfoSuccess {
  ok: true
  tournament: TournamentBracketInfo
}

export type GetTournamentBracketInfoResult = GetTournamentBracketInfoSuccess | ApiFailure

/** GET /tournaments/{id} — só os campos que TO5 precisa (nome, status,
 * categorias com bracketFormat) pras tabs de categoria. Visitor-safe, mesmo
 * raciocínio de listCategoryMatches acima. */
export async function getTournamentBracketInfo(
  tournamentId: string,
): Promise<GetTournamentBracketInfoResult> {
  const response = await visitorSafeGet(`/tournaments/${encodeURIComponent(tournamentId)}`)
  if (!response.ok) return failureFrom(response)
  const wire = (await response.json()) as TournamentBracketInfoWire
  return {
    ok: true,
    tournament: {
      id: wire.id,
      name: wire.name,
      status: wire.status,
      categories: (wire.categories ?? []).map(fromBracketCategoryWire),
    },
  }
}
