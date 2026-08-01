import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as teachersApi from '../../lib/api/teachers'
import type { Teacher } from '../../lib/api/teachers'
import * as classesApi from '../../lib/api/classes'
import * as availabilityApi from '../../lib/api/availability'
import * as earningsApi from '../../lib/api/earnings'
import type { Earnings } from '../../lib/api/earnings'
import * as usePermissionModule from '../../hooks/usePermission'
import TeacherProfilePage from './TeacherProfilePage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function teacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: 'teacher-1',
    fullName: 'Marcus Lima',
    email: 'marcus@teste.com',
    phone: '(48) 99876-5432',
    sports: ['beach_tennis', 'padel'],
    remunerationModel: 'commission',
    remunerationValue: 30,
    certifications: 'CBT Nível 2',
    bio: 'Professor de beach tennis há 8 anos.',
    status: 'active',
    ...overrides,
  }
}

function earnings(overrides: Partial<Earnings> = {}): Earnings {
  return {
    remunerationModel: 'commission',
    classesGivenInPeriod: 42,
    revenueGenerated: 12400,
    pendingAmount: 500,
    paidAmount: 1000,
    currentMonthAmount: 3720,
    history: [
      { period: '2026-02-01', amount: 3200 },
      { period: '2026-03-01', amount: 3400 },
      { period: '2026-04-01', amount: 3100 },
      { period: '2026-05-01', amount: 3310 },
      { period: '2026-06-01', amount: 3560 },
      { period: '2026-07-01', amount: 3720 },
    ],
    breakdown: [],
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1', teacherId = 'teacher-1') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/units/${unitId}/teachers/${teacherId}`]}>
      <Routes>
        <Route
          path="/units/:unitId/teachers"
          element={<div>Lista de professores placeholder</div>}
        />
        <Route path="/units/:unitId/teachers/:teacherId" element={<TeacherProfilePage />} />
        <Route
          path="/units/:unitId/teachers/:teacherId/edit"
          element={<div>PR3 edição placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function mockClassesAndAvailabilityIdle() {
  vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
  vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
  vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))
}

describe('TeacherProfilePage — loading, error and not-found', () => {
  it('shows a loading status while the teacher is being fetched', () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message on a generic failure', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })

  it('shows "Professor não encontrado" on a 404', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'teacher_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/professor não encontrado/i)
  })
})

describe('TeacherProfilePage — header', () => {
  it('renders name, certification pill, contact line and sport dots', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    mockClassesAndAvailabilityIdle()

    renderPage()

    expect(await screen.findByText('Marcus Lima')).toBeInTheDocument()
    expect(screen.getByText('CBT Nível 2')).toBeInTheDocument()
    expect(screen.getByText(/marcus@teste.com/)).toBeInTheDocument()
    expect(screen.getByText(/\(48\) 99876-5432/)).toBeInTheDocument()
  })

  it('omits the certification pill when the teacher has none', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ certifications: null }),
    })
    mockClassesAndAvailabilityIdle()

    renderPage()

    await screen.findByText('Marcus Lima')
    expect(screen.queryByText('CBT Nível 2')).not.toBeInTheDocument()
  })
})

describe('TeacherProfilePage — gear menu permission gate', () => {
  it('hides the gear icon without professores:write', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    mockClassesAndAvailabilityIdle()

    renderPage()

    await screen.findByText('Marcus Lima')
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument()
  })

  it('shows the gear icon with professores:write and opens the "Alterar remuneração" menu', async () => {
    mockPermissions({ 'professores:write': true })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    mockClassesAndAvailabilityIdle()

    renderPage()
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ações' }))

    expect(screen.getByText('Alterar remuneração')).toBeInTheDocument()
  })

  it('navigates to PR3 edit mode when "Editar dados" is clicked (BEAC-1875)', async () => {
    mockPermissions({ 'professores:write': true })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    mockClassesAndAvailabilityIdle()

    renderPage('unit-1', 'teacher-1')
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ações' }))
    await user.click(screen.getByText('Editar dados'))

    expect(await screen.findByText('PR3 edição placeholder')).toBeInTheDocument()
  })
})

describe('TeacherProfilePage — Turmas tab (default)', () => {
  it('fetches with the teacher_id filter and renders each class', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    const listSpy = vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
      ok: true,
      classes: [
        {
          id: 'class-1',
          unitId: 'unit-1',
          teacherId: 'teacher-1',
          sport: 'beach_tennis',
          name: 'BT intermediária',
          courtId: 'court-1',
          courtName: 'Quadra 2',
          rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
          startTime: '18:00',
          endTime: '19:00',
          capacity: 8,
          level: null,
          status: 'active',
        },
      ],
    })
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(await screen.findByText('BT intermediária')).toBeInTheDocument()
    expect(screen.getByText(/ter & qui, 18:00/)).toBeInTheDocument()
    expect(screen.getByText(/Quadra 2/)).toBeInTheDocument()
    expect(listSpy).toHaveBeenCalledWith('unit-1', 'teacher-1')
  })

  it('shows "Nenhuma turma vinculada." when there are none', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(await screen.findByText('Nenhuma turma vinculada.')).toBeInTheDocument()
  })
})

describe('TeacherProfilePage — Horários tab', () => {
  it('maps availability slots to AvailabilityGrid read cells (available/unavailable only, never busy)', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockResolvedValue({
      ok: true,
      availability: [
        { dayOfWeek: 1, timeSlot: '08-10', available: true },
        { dayOfWeek: 1, timeSlot: '10-12', available: false },
      ],
    })
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))

    renderPage()
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Horários' }))

    const availableCell = await screen.findByTestId('availability-cell-1-08-10')
    expect(availableCell).toHaveAttribute('data-status', 'available')
    const unavailableCell = screen.getByTestId('availability-cell-1-10-12')
    expect(unavailableCell).toHaveAttribute('data-status', 'unavailable')
    // Nunca 'busy' numa CÉLULA (a legenda sempre lista as 3 opções, isso é
    // esperado) — sem fonte de dado real disponível nesta task.
    expect(document.querySelector('.availability-cell--read[data-status="busy"]')).toBeNull()
  })
})

describe('TeacherProfilePage — Comissão tab (BEAC-1880, mapeamento de earnings)', () => {
  async function openComissaoTab() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Comissão' }))
  }

  it('renders stat4 with Modelo/Aulas no mês/Receita gerada/Comissão do mês mapped from the earnings response', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'commission', remunerationValue: 30 }),
    })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({
        remunerationModel: 'commission',
        classesGivenInPeriod: 42,
        revenueGenerated: 12400,
        currentMonthAmount: 3720,
      }),
    })

    renderPage()
    await screen.findByText('Marcus Lima')
    await openComissaoTab()

    expect(await screen.findByText('Comissão 30%')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('R$ 12.400,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 3.720,00')).toBeInTheDocument()
  })

  it('shows "—" for Receita gerada when the model is not commission (never a misleading zero)', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'per_class', remunerationValue: 80 }),
    })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({
        remunerationModel: 'per_class',
        revenueGenerated: null,
        currentMonthAmount: 1600,
      }),
    })

    renderPage()
    await screen.findByText('Marcus Lima')
    await openComissaoTab()

    expect(await screen.findByText('R$ 80,00/aula')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('shows "—" for Comissão do mês when current_month_amount is null (commission model without revenue source)', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'commission', remunerationValue: 15 }),
    })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({
        remunerationModel: 'commission',
        revenueGenerated: null,
        currentMonthAmount: null,
      }),
    })

    renderPage()
    await screen.findByText('Marcus Lima')
    await openComissaoTab()

    await screen.findByText('Comissão 15%')
    // Receita gerada E Comissão do mês ambos "—" neste cenário.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders only the last 3 months of the 6-month history as mini-bars', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })

    renderPage()
    await screen.findByText('Marcus Lima')
    await openComissaoTab()

    await screen.findByText('Comissão · últimos 3 meses')
    // history tem 6 entradas (fev-jul); só mai/jun/jul devem aparecer.
    expect(screen.getByText('mai')).toBeInTheDocument()
    expect(screen.getByText('jun')).toBeInTheDocument()
    expect(screen.getByText('jul')).toBeInTheDocument()
    expect(screen.queryByText('fev')).not.toBeInTheDocument()
    expect(screen.queryByText('mar')).not.toBeInTheDocument()
    expect(screen.queryByText('abr')).not.toBeInTheDocument()
  })

  it('shows the fixed hint text and the "Ver como o professor vê" button', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })

    renderPage()
    await screen.findByText('Marcus Lima')
    await openComissaoTab()

    expect(
      await screen.findByText(/Comissão calculada automaticamente por cron mensal/),
    ).toBeInTheDocument()
    expect(screen.getByText('Ver como o professor vê (Meus Ganhos)')).toBeInTheDocument()
  })
})

describe('TeacherProfilePage — Bio tab', () => {
  it('renders the bio text', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ bio: 'Bio de teste do professor.' }),
    })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))

    renderPage()
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Bio' }))

    expect(await screen.findByText('Bio de teste do professor.')).toBeInTheDocument()
  })

  it('shows a fallback message when there is no bio', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ bio: null }),
    })
    vi.spyOn(classesApi, 'listClasses').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))

    renderPage()
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Bio' }))

    expect(await screen.findByText('Nenhuma bio cadastrada.')).toBeInTheDocument()
  })
})

describe('TeacherProfilePage — back link', () => {
  it('navigates back to the teachers list', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    mockClassesAndAvailabilityIdle()

    renderPage()
    await screen.findByText('Marcus Lima')

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: /professores/i }))

    expect(await screen.findByText('Lista de professores placeholder')).toBeInTheDocument()
  })
})
