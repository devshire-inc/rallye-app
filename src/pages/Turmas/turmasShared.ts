// Helpers puros compartilhados por T1 (BEAC-1900, Lista de turmas) e T2
// (BEAC-1901, Detalhe da turma) — mesma ideia de
// ../Agenda/agendaShared.ts: só funções de formatação/cálculo, sem
// JSX/componente React, para as duas telas nunca divergirem sutilmente na
// tradução de RRULE/nível para texto exibido.
import type { RallyeClass } from '../../lib/api/classes'

/** Códigos de dia da semana do RFC 5545 (BYDAY), na ordem em que aparecem
 * numa RRULE típica desta base (ex.: "FREQ=WEEKLY;BYDAY=TU,TH"). */
const BYDAY_LABEL: Record<string, string> = {
  MO: 'seg',
  TU: 'ter',
  WE: 'qua',
  TH: 'qui',
  FR: 'sex',
  SA: 'sáb',
  SU: 'dom',
}

/** Extrai os códigos BYDAY de uma RRULE (ex.: "FREQ=WEEKLY;BYDAY=TU,TH" ->
 * ["TU","TH"]) — parsing mínimo, suficiente para exibir "dias & horário" no
 * card de T1/cabeçalho de T2; não é um parser de RRULE genérico (a
 * validação real de RRULE já acontece no backend, ver
 * api/internal/classes/handler.go validateRRule). */
function byDayCodes(rrule: string): string[] {
  const match = /BYDAY=([A-Z,]+)/.exec(rrule)
  if (!match) return []
  return match[1].split(',').filter(Boolean)
}

/** Junta uma lista de rótulos em PT-BR no padrão do protótipo real: "ter &
 * qui" (2 itens, sem vírgula) ou "seg, qua & sex" (3+ itens, vírgula entre
 * todos menos os 2 últimos, "&" antes do último). */
function joinPtBr(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`
}

/** "ter & qui" a partir de uma RRULE — string vazia se BYDAY estiver
 * ausente/não reconhecido (fallback: exibir só o horário, sem dias). */
export function formatDays(rrule: string): string {
  const labels = byDayCodes(rrule).map((code) => BYDAY_LABEL[code] ?? code)
  return joinPtBr(labels)
}

/** "ter & qui, 18:00" (T1, card de turma — só o horário de início, cópia
 * exata do protótipo real, seção scr-t1). */
export function formatDaysAndStart(rrule: string, startTime: string): string {
  const days = formatDays(rrule)
  return days ? `${days}, ${startTime}` : startTime
}

/** "ter & qui, 18:00–19:00" (T2, cabeçalho — intervalo completo, cópia
 * exata do protótipo real, seção scr-t2). */
export function formatDaysAndRange(rrule: string, startTime: string, endTime: string): string {
  const days = formatDays(rrule)
  const range = `${startTime}–${endTime}`
  return days ? `${days}, ${range}` : range
}

/** Rótulo de nível capitalizado (ex.: "intermediário" -> "Intermediário") —
 * `classes.level` é texto livre no backend (CreateRequest.Level, sem CHECK
 * de catálogo fechado, ao contrário de SkillTier em ../../lib/api/
 * skillLevels.ts), então isto é só uma capitalização de exibição, não uma
 * tradução de catálogo. */
export function levelLabel(level: string | null): string | null {
  if (!level || !level.trim()) return null
  const trimmed = level.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/** "Prof. Marcus" / "Sem professor" — mesmo prefixo "Prof." do protótipo
 * real; teacherName vem vazio quando o LEFT JOIN não encontrou um profile
 * (dado inconsistente) — tratado como "Sem professor" em vez de mostrar uma
 * string vazia. */
export function teacherDisplay(teacherName: string | undefined): string {
  return teacherName && teacherName.trim() ? `Prof. ${teacherName}` : 'Sem professor'
}

/** "Quadra 2" / "—" — mesmo raciocínio de teacherDisplay para courtName. */
export function courtDisplay(courtName: string | undefined): string {
  return courtName && courtName.trim() ? courtName : '—'
}

/** initials de 2 letras (mesmo padrão de StudentProfilePage.tsx/
 * MembersPage.tsx — "Marina Costa" -> "MC"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * A ocupação REAL (quantos alunos estão matriculados) não existe no backend
 * — public.class_enrollments não existe (gap conhecido, ver comentário de
 * módulo de ../../lib/api/classes.ts). `OccupancyInfo` representa
 * explicitamente esse estado "capacidade conhecida, matrícula desconhecida"
 * em vez de um número fabricado: `enrolledKnown: false` sempre, hoje — o
 * campo existe para o dia em que um endpoint real popular isto sem precisar
 * mudar todo o resto da UI que já consome `OccupancyInfo`.
 */
export interface OccupancyInfo {
  capacity: number
  enrolledKnown: false
}

export function occupancyOf(classItem: Pick<RallyeClass, 'capacity'>): OccupancyInfo {
  return { capacity: classItem.capacity, enrolledKnown: false }
}
