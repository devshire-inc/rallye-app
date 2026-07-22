// bookingsToTeacherAgendaClasses: converte os Booking (agenda já carregada
// de AG4) para o formato TeacherAgendaClass que TeacherBlockRequestButton
// espera (../../components/TeacherBlockRequestButton/affectedClasses.ts) —
// esse componente já existia pronto/testado (BEAC-1889), mas modela "aula"
// como turma RECORRENTE (id de turma, weekdays[], daysLabel), não como
// booking individual. Só ocorrências de turma (type=class_occurrence) viram
// TeacherAgendaClass aqui: aula particular (type=private) é um compromisso
// datado único, sem padrão de recorrência por dia da semana — incluí-la
// pelo mesmo cálculo de interseção de weekdays mostraria QUALQUER particular
// que caísse por acaso no mesmo dia da semana do período de bloqueio, não
// só a data real dela, o que seria errado.
//
// LIMITAÇÃO CONHECIDA (aceita, não é escopo desta task resolver): os
// weekdays computados aqui só cobrem os dias presentes na janela ATUALMENTE
// carregada por AG4 (Hoje = 1 dia, Semana = 1 semana) — o próprio
// TeacherBlockRequestButton já documenta que opera sobre "aulas já
// carregadas", então isso é uma limitação aceita de origem, não introduzida
// aqui. Uma turma só materializada 1x na janela de "Hoje" aparece com um
// único weekday, mesmo que na vida real se repita em outros dias.
import type { Booking } from '../../lib/api/bookings'
import type { TeacherAgendaClass } from '../../components/TeacherBlockRequestButton/TeacherBlockRequestButton'
import { WEEKDAY_SHORT_LABELS } from './agendaShared'

/** Converte Date#getDay() (0=domingo..6=sábado) para o índice de
 * WEEKDAY_SHORT_LABELS (0=Seg..6=Dom, semana começa na segunda). */
function toMondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

function formatDaysLabel(weekdays: number[]): string {
  return [...weekdays]
    .sort((a, b) => toMondayFirstIndex(a) - toMondayFirstIndex(b))
    .map((day) => WEEKDAY_SHORT_LABELS[toMondayFirstIndex(day)].toLowerCase())
    .join('/')
}

export function bookingsToTeacherAgendaClasses(bookings: Booking[]): TeacherAgendaClass[] {
  const byClassId = new Map<string, Booking[]>()
  for (const b of bookings) {
    if (b.type !== 'class_occurrence' || !b.classId) continue
    const list = byClassId.get(b.classId) ?? []
    list.push(b)
    byClassId.set(b.classId, list)
  }

  return Array.from(byClassId.entries()).map(([classId, occurrences]) => {
    const first = occurrences[0]
    const weekdays = Array.from(new Set(occurrences.map((o) => new Date(o.startAt).getDay())))
    return {
      id: classId,
      name: first.className ?? 'Turma',
      daysLabel: formatDaysLabel(weekdays),
      time: new Date(first.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      court: first.courtName,
      studentCount: first.studentCount,
      weekdays,
    }
  })
}
