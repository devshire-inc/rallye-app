import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as classesApi from '../../lib/api/classes'
import type { RallyeClass } from '../../lib/api/classes'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking } from '../../lib/api/bookings'
import * as usePermissionModule from '../../hooks/usePermission'
import TurmaDetailPage from './TurmaDetailPage'

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

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    courtId: 'court-1',
    courtName: 'Quadra 2',
    type: 'class_occurrence',
    classId: 'class-1',
    className: 'BT intermediária',
    startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
    teacherName: 'Marcus Lima',
    studentName: null,
    responsibleName: null,
    reason: null,
    unitId: 'unit-1',
    unitName: 'Unit Teste',
    checkedIn: false,
    studentCount: 6,
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1', classId = 'class-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/classes/${classId}`]}>
      <Routes>
        <Route path="/units/:unitId/classes/:classId" element={<TurmaDetailPage />} />
        <Route path="/units/:unitId/classes" element={<div>Lista de turmas placeholder</div>} />
        <Route
          path="/units/:unitId/bookings/:bookingId"
          element={<div>Detalhe da reserva placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TurmaDetailPage — loading/error/not-found', () => {
  it('shows a loading status while the class is being fetched', () => {
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

  it('shows a not-found message when no class in the list matches the route id', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não encontrada/i)
  })
})

describe('TurmaDetailPage — header', () => {
  it('renders sport, teacher, court, days/time and capacity (never a fabricated enrolled count)', async () => {
    mockPermissions({ 'agenda:write': false })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()

    expect(await screen.findByRole('heading', { name: /BT intermediária/ })).toBeInTheDocument()
    expect(screen.getByText(/Beach tennis/)).toBeInTheDocument()
    expect(screen.getByText(/Intermediário/)).toBeInTheDocument()
    expect(
      screen.getByText(/Prof\. Marcus Lima · Quadra 2 · ter & qui, 18:00–19:00 · —\/8 alunos/),
    ).toBeInTheDocument()
  })
})

describe('TurmaDetailPage — settings gear visibility', () => {
  it('shows the [⚙️] settings button for Admin (agenda:write)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Configurações da turma' })).toBeInTheDocument()
  })

  it('hides the [⚙️] settings button for Professor (no agenda:write)', async () => {
    mockPermissions({ 'agenda:write': false })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()

    await screen.findByRole('heading', { name: /BT intermediária/ })
    expect(screen.queryByRole('button', { name: 'Configurações da turma' })).not.toBeInTheDocument()
  })
})

describe('TurmaDetailPage — Alunos/Presença/Waitlist tabs (blocked, no fabricated data)', () => {
  it('shows an explicit pending-endpoint placeholder on Alunos, Presença and Waitlist', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })

    // Alunos é a aba padrão.
    expect(screen.getByText(/endpoint pendente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Adicionar aluno' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Presença' }))
    expect(screen.getByText(/endpoint pendente/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Waitlist' }))
    expect(screen.getByText(/endpoint pendente/i)).toBeInTheDocument()
  })

  it('opens an explanatory sheet instead of a real student search when "+ Adicionar aluno" is tapped', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()
    await screen.findByRole('button', { name: '+ Adicionar aluno' })

    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar aluno' }))

    expect(screen.getByRole('dialog', { name: 'Adicionar aluno' })).toBeInTheDocument()
  })
})

describe('TurmaDetailPage — Próximas tab (real data)', () => {
  it('fetches the unit bookings grid, filters by classId, and lists up to 5 upcoming occurrences', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    const gridSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({ id: 'b1' }),
        booking({ id: 'b2', classId: 'other-class' }), // outra turma, deve ser filtrada
      ],
    })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })

    await userEvent.click(screen.getByRole('tab', { name: 'Próximas' }))

    expect(await screen.findByText('Quadra 2')).toBeInTheDocument()
    expect(gridSpy).toHaveBeenCalledWith('unit-1', expect.any(String), expect.any(String))
  })

  it('navigates to a stub booking-detail route when an upcoming row is tapped', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ id: 'b1' })],
    })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Próximas' }))
    await screen.findByText('Quadra 2')

    await userEvent.click(screen.getByText('Quadra 2').closest('button')!)

    expect(await screen.findByText('Detalhe da reserva placeholder')).toBeInTheDocument()
  })
})

describe('TurmaDetailPage — settings sheet (real PATCH/DELETE)', () => {
  it('edits nome/capacidade/nível via "Editar dados" and reflects the update in the header', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    vi.spyOn(classesApi, 'patchClass').mockResolvedValue({
      ok: true,
      rallyeClass: {
        id: 'class-1',
        unitId: 'unit-1',
        teacherId: 'teacher-1',
        sport: 'beach_tennis',
        name: 'BT intermediária (renomeada)',
        courtId: 'court-1',
        rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
        startTime: '18:00',
        endTime: '19:00',
        capacity: 10,
        level: 'intermediário',
        status: 'active',
      },
    })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })

    await userEvent.click(screen.getByRole('button', { name: 'Configurações da turma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar dados' }))

    const nameInput = screen.getByLabelText('Nome')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'BT intermediária (renomeada)')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByRole('heading', { name: /BT intermediária \(renomeada\)/ }),
    ).toBeInTheDocument()
  })

  it('deactivates the class and navigates back to T1', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })
    vi.spyOn(classesApi, 'deactivateClass').mockResolvedValue({
      ok: true,
      rallyeClass: { ...turma(), status: 'inactive' },
    })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })

    await userEvent.click(screen.getByRole('button', { name: 'Configurações da turma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Desativar turma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desativação' }))

    expect(await screen.findByText('Lista de turmas placeholder')).toBeInTheDocument()
  })

  it('marks "Trocar professor" and "Relatório de frequência" as disabled placeholders (no dependency)', async () => {
    mockPermissions({ 'agenda:write': true })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [turma()] })

    renderPage()
    await screen.findByRole('heading', { name: /BT intermediária/ })
    await userEvent.click(screen.getByRole('button', { name: 'Configurações da turma' }))

    expect(screen.getByRole('button', { name: /Trocar professor/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Relatório de frequência/ })).toBeDisabled()
  })
})
