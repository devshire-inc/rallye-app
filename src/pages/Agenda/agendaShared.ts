// Helpers puros compartilhados por AG1 (BEAC-1903, Calendário Dia) e AG2
// (BEAC-1903, Calendário Semana) — NÃO é uma variação de componente entre as
// duas telas (decisão travada do dispatch: "AG1 e AG2 são estruturalmente
// diferentes... construir como dois componentes separados, NUNCA uma
// variação de props de um componente"), só funções puras de formatação/
// cálculo de grid reaproveitadas para não divergir sutilmente entre as duas
// implementações (ex.: duas fórmulas de linha de grid ligeiramente diferentes
// dariam bugs difíceis de notar). Nenhum JSX/componente React vive aqui.
import type { Booking } from '../../lib/api/bookings'
import type { Court } from '../../lib/api/courts'
import { sportCssVar } from '../../lib/sports'

/** Grade horária do AC de AG1/AG2: "horários como linhas (06h-22h)" — 16
 * linhas de 1h, da 06h (inclusive) à 21h (inclusive; a última linha cobre
 * 21h-22h). */
export const GRID_START_HOUR = 6
export const GRID_END_HOUR = 22
export const HOURS: number[] = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i,
)

/** Linha de grid (1-based, +1 porque a linha 1 é o header de coluna) para um
 * horário — ignora minutos fora de HH:00 (mesmo modelo do protótipo real:
 * blocos só encaixam em fronteiras de hora cheia; nenhum dado de exemplo do
 * artifact usa minutos quebrados). Fora da janela [GRID_START_HOUR,
 * GRID_END_HOUR], satura no limite mais próximo em vez de estourar a grid. */
export function gridRowForInstant(iso: string): number {
  const d = new Date(iso)
  const hour = Math.min(Math.max(d.getHours(), GRID_START_HOUR), GRID_END_HOUR)
  return 2 + (hour - GRID_START_HOUR)
}

/**
 * Classe de cor do bloco `.booking` — AC "coloridos por status (verde=
 * confirmado, âmbar=pendente, azul=particular, vermelho=bloqueio)". Decisão
 * desta implementação (ver relatório de dispatch): `public.bookings.status`
 * (migrations/000034) só modela confirmed/cancelled — NÃO existe um status
 * "pendente" no schema real (o protótipo usa isso para simular "aguardando
 * pagamento" de uma locação avulsa, conceito financeiro não modelado ainda).
 * Por isso a cor é decidida por TYPE, não por um status inexistente:
 * block -> vermelho, private -> azul, os demais confirmados -> verde. A
 * classe `bk-pend`/rótulo "Pendente" continua na legenda (cópia fiel do AC),
 * mas fica sem dado real que a acione até uma feature futura modelar status
 * de pagamento — ver comentário do relatório final.
 */
export type BookingColorClass = 'bk-conf' | 'bk-pend' | 'bk-part' | 'bk-block'

export function bookingColorClass(booking: Pick<Booking, 'type'>): BookingColorClass {
  if (booking.type === 'block') return 'bk-block'
  if (booking.type === 'private') return 'bk-part'
  return 'bk-conf'
}

/** Rótulo curto de tipo em PT-BR, usado no card e no detalhe (AG5). */
export function bookingTypeLabel(type: Booking['type']): string {
  switch (type) {
    case 'class_occurrence':
      return 'Aula em turma'
    case 'private':
      return 'Aula particular'
    case 'rental':
      return 'Aluguel de quadra'
    case 'adhoc':
      return 'Reserva avulsa'
    case 'block':
      return 'Bloqueio'
    default:
      return type
  }
}

/** Título curto exibido dentro do bloco `.booking` — turma usa o nome da
 * turma; particular/avulsa usa o nome do responsável/aluno; bloqueio usa o
 * motivo. */
export function bookingTitle(booking: Booking): string {
  if (booking.className) return booking.className
  if (booking.type === 'private' && booking.studentName) return `Particular · ${booking.studentName}`
  if (booking.responsibleName) return `Locação · ${booking.responsibleName}`
  if (booking.type === 'block') return booking.reason ?? 'Bloqueio'
  return bookingTypeLabel(booking.type)
}

/** Legenda fixa de AG1/AG2 — AC "legenda com 4 itens + Livre — toque para
 * reservar" (cópia exata do rótulo do último item). `colorClass` casa com as
 * classes `.sq-*` de Agenda.css (mesma paleta de `.booking.bk-*`). */
export const LEGEND_ITEMS: { colorClass: string; label: string }[] = [
  { colorClass: 'sq-conf', label: 'Confirmado' },
  { colorClass: 'sq-pend', label: 'Pendente' },
  { colorClass: 'sq-part', label: 'Particular' },
  { colorClass: 'sq-block', label: 'Bloqueio' },
]

/** Alturas fixas de linha do grid de AG1 (px) — usadas tanto pelo CSS
 * (Agenda.css `.cal-grid`) quanto pelo cálculo JS da posição da `.now-line`,
 * para os dois nunca divergirem. */
export const ROW_HEADER_PX = 40
export const ROW_HOUR_PX = 48

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`
}

export function courtSportCssVar(court: Pick<Court, 'sport'>): string {
  return sportCssVar(court.sport)
}

/** AC comum: "Busca (🔍) por aluno, professor ou quadra" — filtro
 * client-side simples (substring, case-insensitive) sobre os campos visíveis
 * no grid; não é uma busca de backend (nenhum endpoint de busca dedicado
 * existe nem foi pedido). */
export function matchesSearch(booking: Booking, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [booking.studentName, booking.teacherName, booking.courtName, booking.responsibleName, booking.className]
    .filter((v): v is string => Boolean(v))
    .some((v) => v.toLowerCase().includes(q))
}

/** "10/07/2026" (mesmo formato de data usado pelos inputs do sheet AG6 no
 * protótipo real, ver #ag6d) a partir de um Date local. */
export function formatDateInput(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

const WEEKDAY_LONG = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** "qui, 10 jul" — usado no dlabel de AG1 ("Hoje · qui, 10 jul") e nos
 * cabeçalhos de grupo de AG3 ("Hoje · qui, 10 jul"). */
export function formatWeekdayDate(date: Date): string {
  return `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Início (00:00 local) e fim (00:00 local do dia seguinte) de um dia, como
 * ISO — janela usada por GET /units/{id}/bookings para AG1 (1 dia). */
export function dayWindow(date: Date): { from: string; to: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

/** Segunda-feira (00:00 local) da semana que contém `date`, e o domingo
 * seguinte (00:00, exclusivo) — janela de AG2 ("1 quadra por vez... dias da
 * semana como colunas"). `getDay()` 0=domingo..6=sábado; a semana do
 * protótipo começa na segunda. */
export function weekWindow(date: Date): { from: string; to: string; monday: Date } {
  const dow = date.getDay()
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday)
  const sundayEnd = new Date(monday)
  sundayEnd.setDate(sundayEnd.getDate() + 7)
  return { from: monday.toISOString(), to: sundayEnd.toISOString(), monday }
}

/** "7 – 13 de julho" — dlabel de AG2. */
export function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const monthName = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ][sunday.getMonth()]
  return `${monday.getDate()} – ${sunday.getDate()} de ${monthName}`
}

export const WEEKDAY_SHORT_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
