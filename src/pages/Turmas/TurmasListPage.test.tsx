import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as classesApi from '../../lib/api/classes'
import type { RallyeClass } from '../../lib/api/classes'
import * as usePermissionModule from '../../hooks/usePermission'
import TurmasListPage from './TurmasListPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function turma(overrides: Partial<RallyeClass> = {}): RallyeClass {
  return {
    id: 'class-1',
    unitId: 'unit-1',
    teacherId: 'teacher-1',
    teacherName: 'Marcus',
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

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/classes`]}>
      <Routes>
        <Route path="/units/:unitId/classes" element={<TurmasListPage />} />
        <Route
          path="/units/:unitId/classes/:classId"
          element={<div>Detalhe da turma placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TurmasListPage — loading and error', () => {
  it('shows a loading status while classes are being fetched', () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('TurmasListPage — Admin vs Professor', () => {
  it('shows the "Nova turma" button and the active count for Admin (agenda:write)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [turma(), turma({ id: 'class-2', name: 'Vôlei recreativo', status: 'inactive' })],
    })

    renderPage()

    expect(await screen.findByText('BT intermediária')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nova turma' })).toBeInTheDocument()
    // 1 ativa (a inativa não conta), independente de filtro/busca.
    expect(screen.getByText('1 ativas')).toBeInTheDocument()
  })

  it('hides the "Nova turma" button for Professor (no agenda:write)', async () => {
    mockPermissions({ 'agenda:write': false })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()

    await screen.findByText('BT intermediária')
    expect(screen.queryByRole('button', { name: 'Nova turma' })).not.toBeInTheDocument()
  })
})

describe('TurmasListPage — card content', () => {
  it('renders sport stripe context, teacher/court/schedule and capacity (never a fabricated enrolled count)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()

    await screen.findByText('BT intermediária')
    expect(screen.getByText(/Prof\. Marcus · Quadra 2 · ter & qui, 18:00/)).toBeInTheDocument()
    expect(screen.getByText(/—\/8 alunos/)).toBeInTheDocument()
  })

  it('shows the "Inativa" badge, reduced-opacity class, and no occupancy bar for an inactive turma', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [turma({ id: 'class-2', name: 'Vôlei recreativo', status: 'inactive' })],
    })

    renderPage()

    const card = await screen.findByTestId('turma-card-class-2')
    expect(card.className).toContain('inactive')
    expect(screen.getByText('Inativa')).toBeInTheDocument()
    expect(within(card).queryByText(/alunos/)).not.toBeInTheDocument()
  })
})

describe('TurmasListPage — filtering', () => {
  it('filters by sport via the tabs2 pills (not a dropdown)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [
        turma({ id: 'bt', name: 'BT intermediária', sport: 'beach_tennis' }),
        turma({ id: 'padel', name: 'Padel iniciante', sport: 'padel' }),
      ],
    })

    renderPage()
    await screen.findByText('BT intermediária')
    expect(screen.getByText('Padel iniciante')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Padel' }))

    expect(screen.getByText('Padel iniciante')).toBeInTheDocument()
    expect(screen.queryByText('BT intermediária')).not.toBeInTheDocument()
  })

  it('searches by class name OR teacher name (single field, no separate teacher dropdown)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [
        turma({ id: 'bt', name: 'BT intermediária', teacherName: 'Marcus' }),
        turma({ id: 'padel', name: 'Padel iniciante', teacherName: 'Ana' }),
      ],
    })

    renderPage()
    await screen.findByText('BT intermediária')

    await userEvent.type(screen.getByLabelText('Buscar turma ou professor'), 'ana')

    expect(screen.getByText('Padel iniciante')).toBeInTheDocument()
    expect(screen.queryByText('BT intermediária')).not.toBeInTheDocument()
  })
})

describe('TurmasListPage — navigation', () => {
  it('navigates to T2 (class detail) when a card is tapped', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()
    await screen.findByText('BT intermediária')

    await userEvent.click(screen.getByTestId('turma-card-class-1'))

    expect(await screen.findByText('Detalhe da turma placeholder')).toBeInTheDocument()
  })
})
