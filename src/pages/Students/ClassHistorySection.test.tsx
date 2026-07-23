import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as classHistoryApi from '../../lib/api/classHistory'
import type { ClassHistoryItem } from '../../lib/api/classHistory'
import * as classesApi from '../../lib/api/classes'
import * as usePermissionModule from '../../hooks/usePermission'
import { ClassHistorySection } from './ClassHistorySection'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function historyItem(overrides: Partial<ClassHistoryItem> = {}): ClassHistoryItem {
  return {
    enrollmentId: 'enr-1',
    classId: 'class-1',
    className: 'BT intermediária',
    sport: 'beach_tennis',
    rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
    startTime: '18:00',
    endTime: '19:00',
    teacherId: 'teacher-1',
    teacherName: 'Marcus Lima',
    enrolledAt: '2026-06-01T00:00:00Z',
    status: 'active',
    ...overrides,
  }
}

function renderSection(unitId = 'unit-1', studentId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={['/units/unit-1/students/student-1']}>
      <Routes>
        <Route
          path="/units/:unitId/students/:studentId"
          element={<ClassHistorySection unitId={unitId} studentId={studentId} />}
        />
        <Route
          path="/units/:unitId/classes/:classId"
          element={<div>Detalhe da turma placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClassHistorySection — loading/error/empty', () => {
  it('shows a loading status while the history is being fetched', () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockReturnValue(new Promise(() => {}))

    renderSection()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderSection()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar o histórico de turmas/i,
    )
  })

  it('shows an empty state when there is no enrollment', async () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({ ok: true, classHistory: [] })

    renderSection()

    expect(await screen.findByText(/nenhuma matrícula encontrada/i)).toBeInTheDocument()
  })
})

describe('ClassHistorySection — list rendering (prototype copy: "ter & qui 18:00 · Prof. Marcus")', () => {
  it('renders class name, sport strip color, and "{dias} {horário} · Prof. {professor}" schedule label', async () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({
      ok: true,
      classHistory: [historyItem()],
    })

    const { container } = renderSection()

    await screen.findByText('BT intermediária')
    expect(screen.getByText('ter & qui 18:00 · Prof. Marcus Lima')).toBeInTheDocument()

    const strip = container.querySelector('.p-row .strip') as HTMLElement
    expect(strip.style.background).toContain('--sport-beach-tennis')
  })

  it('shows a muted "Encerrada" badge for status=ended, and no badge for status=active', async () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({
      ok: true,
      classHistory: [
        historyItem({ enrollmentId: 'enr-1', className: 'BT intermediária', status: 'active' }),
        historyItem({ enrollmentId: 'enr-2', className: 'Padel iniciante', status: 'ended' }),
      ],
    })

    renderSection()

    await screen.findByText('BT intermediária')
    const endedRow = screen.getByTestId('class-history-row-enr-2')
    expect(endedRow).toHaveTextContent('Encerrada')
    const activeRow = screen.getByTestId('class-history-row-enr-1')
    expect(activeRow).not.toHaveTextContent('Encerrada')
  })

  it('navigates to the T2 route when a row is clicked', async () => {
    mockPermissions({})
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({
      ok: true,
      classHistory: [historyItem({ classId: 'class-42' })],
    })

    renderSection('unit-1', 'student-1')
    await screen.findByText('BT intermediária')

    await userEvent.click(screen.getByTestId('class-history-row-enr-1'))

    expect(await screen.findByText('Detalhe da turma placeholder')).toBeInTheDocument()
  })
})

describe('ClassHistorySection — "Adicionar a turma" (hide always, never disable)', () => {
  it('hides the button when the viewer lacks alunos:write or agenda:write', async () => {
    mockPermissions({ 'alunos:write': true, 'agenda:write': false })
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({ ok: true, classHistory: [] })

    renderSection()
    await screen.findByText(/nenhuma matrícula encontrada/i)

    expect(screen.queryByRole('button', { name: /adicionar a turma/i })).not.toBeInTheDocument()
  })

  it('shows the button and opens the enrollment sheet when the viewer has both permissions', async () => {
    mockPermissions({ 'alunos:write': true, 'agenda:write': true })
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({ ok: true, classHistory: [] })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))

    renderSection()
    await screen.findByText(/nenhuma matrícula encontrada/i)

    const button = screen.getByRole('button', { name: /adicionar a turma/i })
    await userEvent.click(button)

    expect(await screen.findByRole('dialog', { name: /adicionar a turma/i })).toBeInTheDocument()
  })
})
