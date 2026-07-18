// Cliente HTTP de GET/PATCH /students/{id}/skill-levels(/{sport}) —
// BEAC-1853 (story BEAC-1690, Eixo 1 do Sistema de Níveis), consumido pela
// seção "Nível por esporte" da aba Dados de AL2 (BEAC-1856, story
// BEAC-1691). Contrato lido diretamente do handler REAL (não da descrição
// da task) em
// rallye-api-beac1690/api/internal/skilllevels/handler.go antes de escrever
// este cliente:
//
//   - GET /students/{id}/skill-levels -> { skill_levels: [{ sport, tier,
//     updated_by, updated_at }, ...] } — uma linha por esporte PRATICADO
//     (não uma lista fixa de esportes); leitura do próprio nível sempre
//     liberada ao aluno, senão exige permission alunos:read.
//   - PATCH /students/{id}/skill-levels/{sport} body { tier } -> devolve o
//     skillLevelItem atualizado (upsert); exige alunos:write (checado pelo
//     middleware antes do handler).
//
// Nota: rota NÃO é unit-scoped (`/students/{id}/...`, não
// `/units/{unitId}/students/{id}/...`) — mesma forma refletida aqui.
import { apiFetch } from '../httpClient'

/** Espelha validSports do handler real — mesmos slugs de ../sports.ts
 * (SPORTS), não redeclarados como union próprio para não divergir. */
export type SkillSport = 'beach_tennis' | 'padel' | 'futevolei' | 'volei'

/** Espelha validTiers do handler real, na ordem crescente de habilidade. */
export type SkillTier = 'pe_na_areia' | 'd' | 'c' | 'b' | 'a' | 'pro_open'

export const SKILL_TIERS: { value: SkillTier; label: string }[] = [
  { value: 'pe_na_areia', label: 'Pé na Areia' },
  { value: 'd', label: 'D' },
  { value: 'c', label: 'C' },
  { value: 'b', label: 'B' },
  { value: 'a', label: 'A' },
  { value: 'pro_open', label: 'Pro/Open' },
]

export interface SkillLevel {
  sport: string
  tier: SkillTier
  updatedBy: string | null
  updatedAt: string
}

type SkillLevelWire = {
  sport: string
  tier: SkillTier
  updated_by: string | null
  updated_at: string
}

function fromWire(wire: SkillLevelWire): SkillLevel {
  return {
    sport: wire.sport,
    tier: wire.tier,
    updatedBy: wire.updated_by,
    updatedAt: wire.updated_at,
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

export interface ListSkillLevelsSuccess {
  ok: true
  skillLevels: SkillLevel[]
}

export type ListSkillLevelsResult = ListSkillLevelsSuccess | ApiFailure

/** GET /students/{id}/skill-levels */
export async function listSkillLevels(studentId: string): Promise<ListSkillLevelsResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/skill-levels`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { skill_levels: SkillLevelWire[] }
  return { ok: true, skillLevels: body.skill_levels.map(fromWire) }
}

export interface PatchSkillLevelSuccess {
  ok: true
  skillLevel: SkillLevel
}

export type PatchSkillLevelResult = PatchSkillLevelSuccess | ApiFailure

/** PATCH /students/{id}/skill-levels/{sport} — upsert do tier daquele
 * esporte (a primeira escrita para um (aluno, esporte) é o que torna aquele
 * esporte "praticado", ver comentário de pacote do handler real). */
export async function patchSkillLevel(
  studentId: string,
  sport: string,
  tier: SkillTier,
): Promise<PatchSkillLevelResult> {
  const response = await apiFetch(
    `/students/${encodeURIComponent(studentId)}/skill-levels/${encodeURIComponent(sport)}`,
    { method: 'PATCH', body: JSON.stringify({ tier }) },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as SkillLevelWire
  return { ok: true, skillLevel: fromWire(body) }
}
