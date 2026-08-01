// Helpers e tipos compartilhados pelas 3 telas do fluxo self-service
// "Agendar aula" (Aluno) — Figma "06/07/08 · Agendar — Escolher
// Horário/Confirmar/Sucesso — Aluno" (fileKey hb7PA0Xx3L7iHjt9AfHsGK, nodes
// 159:1576/183:2954, 159:1618/183:2973, 159:1660/183:2992).
//
// Apesar do nome do arquivo (histórico — nasceu 100% mockado, ver git log),
// hoje só guarda o que continua útil depois da integração com a API real
// (../../lib/api/classOccurrences.ts): o catálogo de esportes do fluxo, a
// tira de datas (sempre foi real — só os SLOTS eram mock) e os tipos de
// seleção/resultado repassados via router `state` entre as 3 telas.
import { SPORTS } from '../../lib/sports'
import type { ClassOccurrence } from '../../lib/api/classOccurrences'

/** Só os 3 esportes que aparecem nos frames Figma desta tela (Beach Tennis/
 * Padel/Vôlei) — não os 6 do catálogo completo de `SPORTS`. */
export const AGENDAR_SPORT_SLUGS = ['beach_tennis', 'padel', 'volei'] as const

export const AGENDAR_SPORTS = SPORTS.filter((s) => (AGENDAR_SPORT_SLUGS as readonly string[]).includes(s.slug))

export interface AgendarDateOption {
  iso: string
  weekdayShort: string
  day: number
  monthShort: string
}

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Tira de datas a partir de hoje (7 dias) — mesmo formato "qui · 18" do
 * Figma. Usada como filtro (`from`/`to`) de GET .../classes/occurrences. */
export function buildAgendarDateStrip(from: Date, count = 7): AgendarDateOption[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    return {
      iso: d.toISOString().slice(0, 10),
      weekdayShort: WEEKDAY_SHORT[d.getDay()],
      day: d.getDate(),
      monthShort: MONTH_SHORT[d.getMonth()],
    }
  })
}

export function formatPriceCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

/** Seleção acumulada nos 2 primeiros passos do wizard, repassada via router
 * `state` (mesmo padrão de AG5BookingDetailPage.tsx recebendo `booking` via
 * location.state — sem back-end para "retomar" o passo por deep link).
 * `courtName`/`teacherName` são resolvidos client-side (GET /units/{id}/courts
 * e GET /units/{id}/teachers) porque GET .../classes/occurrences só devolve
 * `court_id`/`teacher_id` — ver comentário de pacote de
 * AgendarEscolherHorarioPage.tsx. */
export interface AgendarSelection {
  unitId: string
  unitName: string
  occurrence: ClassOccurrence
  courtName: string
  teacherName: string
}

export interface AgendarResult extends AgendarSelection {
  bookingId: string
  /** ISO/RFC3339 — vem de `added_at` da resposta de POST .../occurrences/book. */
  confirmedAt: string
}
