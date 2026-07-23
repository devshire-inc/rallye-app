import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as classesApi from '../../lib/api/classes'
import type { RallyeClass } from '../../lib/api/classes'
import * as enrollmentsApi from '../../lib/api/enrollments'
import { AddToClassSheet } from './AddToClassSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function turma(overrides: Partial<RallyeClass> = {}): RallyeClass {
  return {
    id: 'class-1',
    unitId: 'unit-1',
    teacherId: 'teacher-1',
    teacherName: 'Marcus Lima',
    sport: 'beach_tennis',
    name: 'BT intermediária',
    courtId: 'court-1',
    courtName: 'Quadra 2',
    rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
    startTime: '18:00',
    endTime: '19:00',
    capacity: 8,
    level: 'intermediário',
    status: 'active',
    ...overrides,
  }
}

function renderSheet(overrides: Partial<Parameters<typeof AddToClassSheet>[0]> = {}) {
  const onEnrolled = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <AddToClassSheet
      unitId="unit-1"
      studentId="student-1"
      excludeClassIds={new Set()}
      onEnrolled={onEnrolled}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { ...utils, onEnrolled, onClose }
}

describe('AddToClassSheet — loading/error/empty', () => {
  it('shows a loading status while classes are being fetched', () => {
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))

    renderSheet()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderSheet()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar as turmas/i,
    )
  })

  it('shows an empty state when there are no active classes to enroll into', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [turma({ status: 'inactive' })],
    })

    renderSheet()

    expect(await screen.findByText(/nenhuma turma disponível/i)).toBeInTheDocument()
  })
})

describe('AddToClassSheet — filtering', () => {
  it('excludes classes already in excludeClassIds (already actively enrolled)', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [turma({ id: 'class-1' }), turma({ id: 'class-2', name: 'BT iniciante' })],
    })

    renderSheet({ excludeClassIds: new Set(['class-1']) })

    await screen.findByText('BT iniciante')
    expect(screen.queryByText('BT intermediária')).not.toBeInTheDocument()
  })
})

describe('AddToClassSheet — enrollment flow', () => {
  it('enrolls the student in the chosen class and calls onEnrolled on success', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    const createSpy = vi.spyOn(enrollmentsApi, 'createEnrollment').mockResolvedValue({
      ok: true,
      enrollment: {
        id: 'enr-1',
        classId: 'class-1',
        studentId: 'student-1',
        studentName: 'Marina Costa',
        enrolledAt: '2026-07-23T00:00:00Z',
        status: 'active',
        capacityWarning: false,
      },
    })

    const { onEnrolled } = renderSheet()
    await screen.findByText('BT intermediária')

    await userEvent.click(screen.getByTestId('add-to-class-row-class-1'))

    expect(createSpy).toHaveBeenCalledWith('class-1', 'student-1')
    expect(onEnrolled).toHaveBeenCalled()
  })

  it('shows a specific inline message on 409 already_enrolled, without calling onEnrolled', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    vi.spyOn(enrollmentsApi, 'createEnrollment').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'already_enrolled',
    })

    const { onEnrolled } = renderSheet()
    await screen.findByText('BT intermediária')

    await userEvent.click(screen.getByTestId('add-to-class-row-class-1'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/já está matriculado/i)
    expect(onEnrolled).not.toHaveBeenCalled()
  })

  it('shows a generic error message on other failures', async () => {
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    vi.spyOn(enrollmentsApi, 'createEnrollment').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderSheet()
    await screen.findByText('BT intermediária')

    await userEvent.click(screen.getByTestId('add-to-class-row-class-1'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível matricular/i)
  })
})
