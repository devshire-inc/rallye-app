// Dados MOCKADOS do fluxo self-service "Agendar aula" (Aluno) — Figma
// "06/07/08 · Agendar — Escolher Horário/Confirmar/Sucesso — Aluno" (fileKey
// hb7PA0Xx3L7iHjt9AfHsGK, nodes 159:1576/183:2954, 159:1618/183:2973,
// 159:1660/183:2992).
//
// GAP DE BACKEND (ver comentário de pacote de AgendarEscolherHorarioPage.tsx
// para o relatório completo): não existe nenhum endpoint de "horários
// disponíveis por esporte/quadra/dia" (disponibilidade de QUADRA — não
// confundir com GET /teachers/{id}/availability, que é a grade pessoal de
// horário de trabalho do professor, ../lib/api/availability.ts, endpoint
// totalmente diferente). Sem esse endpoint, esta tela não tem como buscar
// slots/preço/vagas reais — os dados abaixo são estáticos, só para preencher
// a UI com um estado plausível (mesmo espírito de outros gaps documentados
// nesta sessão, ex.: AG5BookingDetailPage "Alunos" quando falta matrícula
// modelada). NENHUM destes dados é persistido nem head-checado contra o
// backend real.
import { SPORTS } from '../../lib/sports'

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
 * Figma. Real (datas de verdade), só os SLOTS abaixo é que são mock. */
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

export interface AgendarSlotOption {
  time: string
  endTime: string
  priceValue: number
  spotsTaken: number
  spotsTotal: number
}

/** Mesmos 4 horários/preços/vagas do frame Figma (07:00/09:00/14:00/18:00) —
 * repetidos para toda data da tira (mock, ver comentário de módulo). */
export const AGENDAR_MOCK_SLOTS: AgendarSlotOption[] = [
  { time: '07:00', endTime: '08:00', priceValue: 45, spotsTaken: 3, spotsTotal: 4 },
  { time: '09:00', endTime: '10:00', priceValue: 45, spotsTaken: 2, spotsTotal: 4 },
  { time: '14:00', endTime: '15:00', priceValue: 60, spotsTaken: 4, spotsTotal: 4 },
  { time: '18:00', endTime: '19:00', priceValue: 60, spotsTaken: 1, spotsTotal: 4 },
]

export function isSlotFull(slot: AgendarSlotOption): boolean {
  return slot.spotsTaken >= slot.spotsTotal
}

export function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

export function formatPriceCents(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

/** Nome de turma/quadra/professor mockados — mesmo texto fixo do Figma
 * ("Beach Tennis Iniciante" / "Quadra 1" / "Marcus Lima"), sem fonte real de
 * dados (sem matrícula/turma real ligada a este fluxo, ver gap de módulo). */
export const AGENDAR_MOCK_COURT_NAME = 'Quadra 1'
export const AGENDAR_MOCK_TEACHER_NAME = 'Marcus Lima'

export function agendarClassTitle(sportLabel: string): string {
  return `${sportLabel} Iniciante`
}

/** Seleção acumulada nos 3 passos do wizard, repassada via router `state`
 * (mesmo padrão de AG5BookingDetailPage.tsx recebendo `booking` via
 * location.state — sem back-end para "retomar" o passo por deep link). */
export interface AgendarSelection {
  unitId: string
  unitName: string
  sport: string
  sportLabel: string
  date: AgendarDateOption
  slot: AgendarSlotOption
}

export interface AgendarResult extends AgendarSelection {
  confirmedAt: string
}
