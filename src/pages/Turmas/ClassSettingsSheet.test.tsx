import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as classesApi from '../../lib/api/classes'
import type { RallyeClass } from '../../lib/api/classes'
import * as courtsApi from '../../lib/api/courts'
import { ClassSettingsSheet } from './ClassSettingsSheet'

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

describe('ClassSettingsSheet — trocar quadra (real GET /units/{id}/courts + PATCH /classes/{id})', () => {
  it('lists real courts and calls patchClass with the selected court id', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({
      ok: true,
      courts: [
        { id: 'court-1', unitId: 'unit-1', name: 'Quadra 2', sport: 'beach_tennis', status: 'active' },
        { id: 'court-3', unitId: 'unit-1', name: 'Quadra 3', sport: 'beach_tennis', status: 'active' },
      ],
    })
    const patchSpy = vi.spyOn(classesApi, 'patchClass').mockResolvedValue({
      ok: true,
      rallyeClass: { ...turma(), courtId: 'court-3' },
    })
    const onUpdated = vi.fn()

    render(
      <ClassSettingsSheet
        unitId="unit-1"
        classItem={turma()}
        onUpdated={onUpdated}
        onDeactivated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Trocar quadra' }))
    await screen.findByText('Quadra 3')

    await userEvent.selectOptions(screen.getByLabelText('Quadra'), 'court-3')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(patchSpy).toHaveBeenCalledWith('class-1', { courtId: 'court-3' })
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ courtId: 'court-3' }))
  })
})

describe('ClassSettingsSheet — menu items without a real dependency', () => {
  it('renders "Trocar professor" and "Relatório de frequência" as disabled with an explanation', () => {
    render(
      <ClassSettingsSheet
        unitId="unit-1"
        classItem={turma()}
        onUpdated={vi.fn()}
        onDeactivated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const teacherButton = screen.getByRole('button', { name: /Trocar professor/ })
    const reportButton = screen.getByRole('button', { name: /Relatório de frequência/ })
    expect(teacherButton).toBeDisabled()
    expect(reportButton).toBeDisabled()
    expect(teacherButton.title).toMatch(/professores/i)
    expect(reportButton.title).toMatch(/presença/i)
  })
})
