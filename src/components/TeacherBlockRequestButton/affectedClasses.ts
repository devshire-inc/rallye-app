// Computa quais das aulas já carregadas na agenda do professor caem dentro
// do período de bloqueio solicitado (BEAC-1889's info box "Isso afeta: ...")
// — sem nenhum endpoint novo: opera inteiramente sobre os dados de agenda já
// carregados pelo chamador (prop `classes`), cruzando os weekdays de cada
// aula recorrente contra o conjunto de dias-da-semana cobertos pelo período
// [startDate, endDate].
const MAX_DAYS_SCANNED = 400

export interface TeacherAgendaClass {
  id: string
  name: string
  /** Rótulo pré-formatado pelo chamador (ex.: "seg/qua/sex") — este módulo
   * não faz nenhuma formatação de nome de dia/locale, só usa `weekdays`
   * para o cálculo de interseção. */
  daysLabel: string
  time: string
  court: string
  studentCount: number
  /** Dias da semana em que esta aula recorre, na mesma convenção de
   * `Date#getDay()`: 0 = domingo .. 6 = sábado. */
  weekdays: number[]
}

/** Devolve o subconjunto (na ordem original) de `classes` cujo weekday
 * intersecta algum dia dentro de [startDate, endDate] — strings de
 * datetime-local ou ISO, parseáveis por `new Date(...)`. Datas ausentes,
 * inválidas, ou um período invertido (endDate < startDate) resultam em []
 * (sem nenhuma aula "afetada" até o formulário ter um período válido). */
export function computeAffectedClasses(
  classes: TeacherAgendaClass[],
  startDate: string,
  endDate: string,
): TeacherAgendaClass[] {
  if (!startDate || !endDate) return []

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  if (end.getTime() < start.getTime()) return []

  const coveredWeekdays = new Set<number>()
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  for (let i = 0; i <= MAX_DAYS_SCANNED && cursor.getTime() <= lastDay.getTime(); i++) {
    coveredWeekdays.add(cursor.getDay())
    // 7 dias já cobre todos os weekdays possíveis — early exit evita
    // iterar um período longo desnecessariamente.
    if (coveredWeekdays.size === 7) break
    cursor.setDate(cursor.getDate() + 1)
  }

  return classes.filter((klass) => klass.weekdays.some((day) => coveredWeekdays.has(day)))
}
