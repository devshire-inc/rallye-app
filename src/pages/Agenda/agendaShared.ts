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

/** "Quadra 1 · 6 alunos" (turma) / "Quadra 2 · individual" (particular) — o
 * subtítulo que o frame 35:1096 desenha, prefixado pela ARENA quando o
 * professor tem aula em mais de uma no período exibido.
 *
 * A contagem vem de `studentCount`, que `getBookingsGrid` já devolve por
 * reserva — nenhuma chamada por aula. Em `type=private` o backend manda 0 de
 * propósito (o aluno vive em `student_name`, não em `booking_participants`,
 * ver lib/api/bookings.ts), e "0 alunos" seria uma mentira: para esse tipo o
 * rótulo é "individual", igual ao frame, com o nome do aluno subindo para o
 * TÍTULO do bloco via bookingTitle ("Particular · Marina Costa"). */
export function bookingSubtitle(booking: Booking, withArena: boolean): string {
  const who =
    booking.type === 'private'
      ? 'individual'
      : `${booking.studentCount} ${booking.studentCount === 1 ? 'aluno' : 'alunos'}`
  return [withArena ? booking.unitName : null, booking.courtName, who].filter(Boolean).join(' · ')
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

/** Mesma legenda, no vocabulário de "tom de status" que AgendaMobile/
 * AgendaDesktop consomem (`data-tone`) — os rótulos são os MESMOS de
 * LEGEND_ITEMS, que continua servindo AG2 (grade de semana com as classes
 * `.sq-*`). */
export type BookingTone = 'confirmado' | 'pendente' | 'particular' | 'bloqueio'

export const LEGEND_TONE_ITEMS: { status: BookingTone; label: string }[] = [
  { status: 'confirmado', label: 'Confirmado' },
  { status: 'pendente', label: 'Pendente' },
  { status: 'particular', label: 'Particular' },
  { status: 'bloqueio', label: 'Bloqueio' },
]

/** Tom de status de uma reserva — mesma decisão de bookingColorClass
 * (cor por TYPE, porque `public.bookings.status` não modela "pendente"),
 * só que no vocabulário dos componentes de agenda. */
export function bookingTone(booking: Pick<Booking, 'type'>): BookingTone {
  if (booking.type === 'block') return 'bloqueio'
  if (booking.type === 'private') return 'particular'
  return 'confirmado'
}

/** "07:00" — hora local de um instante ISO, no formato "HH:MM" que
 * AgendaMobile/AgendaDesktop esperam em `start`/`end`. */
export function formatHM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Os 7 dias da semana que contém `date`, começando no DOMINGO — é a
 * convenção da weekStrip dos frames de Agenda (DOM..SÁB), diferente da
 * semana Seg-Dom de weekWindow/AG2 (que é a janela de BUSCA da grade de
 * semana, não uma tira de navegação). */
export function weekDaysSunday(date: Date): Date[] {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** "2026-07-28" (local, sem o shift de fuso de toISOString). */
export function formatISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

/** "26 jul – 1 ago" — rótulo do navegador de semana dos frames de Agenda. */
export function formatShortRange(from: Date, to: Date): string {
  return `${from.getDate()} ${MONTH_SHORT[from.getMonth()]} – ${to.getDate()} ${MONTH_SHORT[to.getMonth()]}`
}

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

/** "qui, 18 jul · 18:00" — subtítulo do detalhe da reserva (AG5), frames
 * 5:246 (Admin Mobile) / 35:1162 (Professor Mobile), onde a linha abaixo do
 * título é "Aula em turma · qui, 18 jul · 18:00". Montado a partir de partes
 * (`weekday`/`month` curtos) em vez de um `toLocaleDateString` único porque o
 * pt-BR intercala "de" ("qui., 18 de jul.") e o frame não tem esse "de". */
export function bookingWhenLabel(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace(/\.$/, '')
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace(/\.$/, '')
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday}, ${date.getDate()} ${month} · ${time}`
}

/** "8 matriculados" / "1 matriculado" — linha "Alunos" do detalhe (AG5). O
 * número vem de `studentCount`, que `getBookingsGrid` já devolve (mesmo campo
 * que AG4 usa no bloco da timeline desde fd4b759) — nenhuma chamada nova. */
export function enrolledLabel(studentCount: number): string {
  return `${studentCount} ${studentCount === 1 ? 'matriculado' : 'matriculados'}`
}
