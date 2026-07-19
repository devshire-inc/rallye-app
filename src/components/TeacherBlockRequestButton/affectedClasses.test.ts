import { describe, expect, it } from 'vitest'
import { computeAffectedClasses, type TeacherAgendaClass } from './affectedClasses'

const btIniciante: TeacherAgendaClass = {
  id: 'class-1',
  name: 'BT iniciante',
  daysLabel: 'seg/qua/sex',
  time: '07:00',
  court: 'Quadra 1',
  studentCount: 8,
  // seg=1, qua=3, sex=5 (convenção Date#getDay(): 0=dom..6=sáb)
  weekdays: [1, 3, 5],
}

const padelAvancado: TeacherAgendaClass = {
  id: 'class-2',
  name: 'Padel avançado',
  daysLabel: 'ter/qui',
  time: '19:00',
  court: 'Quadra 2',
  studentCount: 4,
  weekdays: [2, 4],
}

const classes = [btIniciante, padelAvancado]

describe('computeAffectedClasses', () => {
  it('returns classes whose weekday falls within the requested period', () => {
    // 2026-07-20 é uma segunda-feira (weekday 1) — bate com btIniciante.
    const result = computeAffectedClasses(classes, '2026-07-20T00:00', '2026-07-20T23:59')
    expect(result).toEqual([btIniciante])
  })

  it('returns multiple classes when the period spans several weekdays', () => {
    // 2026-07-20 (seg) a 2026-07-23 (qui) cobre seg/ter/qua/qui.
    const result = computeAffectedClasses(classes, '2026-07-20T00:00', '2026-07-23T00:00')
    expect(result).toEqual([btIniciante, padelAvancado])
  })

  it('returns an empty array when no class falls on any weekday in the period', () => {
    // 2026-07-25 é sábado (weekday 6) e 2026-07-26 é domingo (weekday 0) —
    // nenhuma das duas turmas acontece nesses dias.
    const result = computeAffectedClasses(classes, '2026-07-25T00:00', '2026-07-26T23:59')
    expect(result).toEqual([])
  })

  it('returns an empty array when startDate or endDate is missing/invalid', () => {
    expect(computeAffectedClasses(classes, '', '2026-07-20T00:00')).toEqual([])
    expect(computeAffectedClasses(classes, '2026-07-20T00:00', '')).toEqual([])
    expect(computeAffectedClasses(classes, 'not-a-date', '2026-07-20T00:00')).toEqual([])
  })

  it('returns an empty array when endDate is before startDate', () => {
    const result = computeAffectedClasses(classes, '2026-07-23T00:00', '2026-07-20T00:00')
    expect(result).toEqual([])
  })

  it('preserves the original classes order, not the weekday-match order', () => {
    const result = computeAffectedClasses(
      [padelAvancado, btIniciante],
      '2026-07-20T00:00',
      '2026-07-23T00:00',
    )
    expect(result).toEqual([padelAvancado, btIniciante])
  })
})
