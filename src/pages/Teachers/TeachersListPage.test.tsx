import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as teachersApi from '../../lib/api/teachers'
import type { TeacherListItem } from '../../lib/api/teachers'
import * as usePermissionModule from '../../hooks/usePermission'
import TeachersListPage from './TeachersListPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function teacher(overrides: Partial<TeacherListItem> = {}): TeacherListItem {
  return {
    id: 'teacher-1',
    fullName: 'Marcus Lima',
    email: 'marcus@teste.com',
    phone: '(48) 99876-5432',
    sports: ['beach_tennis', 'padel'],
    remunerationModel: 'commission',
    remunerationValue: 30,
    status: 'active',
    turmasCount: 5,
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/units/${unitId}/teachers`]}>
      <Routes>
        <Route path="/units/:unitId/teachers" element={<TeachersListPage />} />
        <Route
          path="/units/:unitId/teachers/:teacherId"
          element={<div>Perfil do professor placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeachersListPage — loading and error', () => {
  it('shows a loading status while teachers are being fetched', () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('TeachersListPage — empty states', () => {
  it('shows "nenhum professor cadastrado" when the list is empty and there is no search query', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: true, teachers: [] })

    renderPage()

    expect(await screen.findByText(/nenhum professor cadastrado/i)).toBeInTheDocument()
  })

  it('shows a distinct empty message when a search returns no results', async () => {
    mockPermissions({})
    const listSpy = vi
      .spyOn(teachersApi, 'listTeachers')
      .mockResolvedValue({ ok: true, teachers: [] })

    renderPage()
    await screen.findByText(/nenhum professor cadastrado/i)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/buscar professor/i), 'Zzz')

    expect(
      await screen.findByText(/nenhum professor encontrado para esta busca/i),
    ).toBeInTheDocument()
    expect(listSpy).toHaveBeenLastCalledWith('unit-1', 'Zzz')
  })
})

describe('TeachersListPage — list rendering', () => {
  it('renders the header count and each row (avatar initials, sport dots, turmas count, remuneration, status)', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({
      ok: true,
      teachers: [
        teacher(),
        teacher({
          id: 'teacher-2',
          fullName: 'Ana Beltrão',
          sports: ['padel'],
          remunerationModel: 'per_class',
          remunerationValue: 80,
          turmasCount: 3,
        }),
        teacher({
          id: 'teacher-3',
          fullName: 'Duda Rocha',
          sports: ['futevolei'],
          remunerationModel: 'fixed',
          remunerationValue: 3500,
          turmasCount: 2,
        }),
        teacher({
          id: 'teacher-4',
          fullName: 'Felipe Souza',
          sports: ['volei'],
          remunerationModel: 'per_class',
          remunerationValue: 100,
          status: 'inactive',
          turmasCount: 0,
        }),
      ],
    })

    renderPage()

    expect(await screen.findByText('Marcus Lima')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()

    expect(screen.getByText('Comissão 30%')).toBeInTheDocument()
    expect(screen.getByText('R$ 80,00/aula')).toBeInTheDocument()
    expect(screen.getByText('R$ 3.500,00/mês')).toBeInTheDocument()

    expect(screen.getAllByText('Ativo')).toHaveLength(3)
    expect(screen.getByText('Inativo')).toBeInTheDocument()

    expect(screen.getByText(/0 turmas/)).toBeInTheDocument()
    expect(screen.getByText(/5 turmas/)).toBeInTheDocument()
  })

  it('navigates to the teacher profile when a row is clicked', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: true, teachers: [teacher()] })

    renderPage()
    const row = await screen.findByTestId('teacher-row-teacher-1')

    const user = userEvent.setup()
    await user.click(row)

    expect(await screen.findByText('Perfil do professor placeholder')).toBeInTheDocument()
  })
})

describe('TeachersListPage — permission gate on "+ Novo professor"', () => {
  it('hides the create button without professores:write', async () => {
    mockPermissions({})
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: true, teachers: [] })

    renderPage()
    await screen.findByText(/nenhum professor cadastrado/i)

    expect(screen.queryByText('+ Novo professor')).not.toBeInTheDocument()
  })

  it('shows the create button with professores:write', async () => {
    mockPermissions({ 'professores:write': true })
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: true, teachers: [] })

    renderPage()
    await screen.findByText(/nenhum professor cadastrado/i)

    expect(screen.getByText('+ Novo professor')).toBeInTheDocument()
  })
})
