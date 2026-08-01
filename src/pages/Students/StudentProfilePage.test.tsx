import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as studentsApi from '../../lib/api/students'
import * as skillLevelsApi from '../../lib/api/skillLevels'
import * as classHistoryApi from '../../lib/api/classHistory'
import * as usePermissionModule from '../../hooks/usePermission'
import StudentProfilePage from './StudentProfilePage'

afterEach(() => {
  vi.restoreAllMocks()
})

type PermissionMap = Record<string, boolean>

function mockPermissions(map: PermissionMap) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function renderPage(unitId = 'unit-1', studentId = 'student-1') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/units/${unitId}/students/${studentId}`]}>
      <Routes>
        <Route path="/units/:unitId/students/:studentId" element={<StudentProfilePage />} />
        <Route path="/perfil" element={<div>Perfil placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StudentProfilePage — permission gate', () => {
  it('shows only an access-denied message without alunos:read, and never fetches the student', () => {
    mockPermissions({})
    const getStudentSpy = vi.spyOn(studentsApi, 'getStudent')

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(/não tem permissão para ver o perfil/i)
    expect(getStudentSpy).not.toHaveBeenCalled()
  })
})

describe('StudentProfilePage — loading and error', () => {
  it('shows a loading status while the student is being fetched', () => {
    mockPermissions({ 'alunos:read': true })
    vi.spyOn(studentsApi, 'getStudent').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({ 'alunos:read': true })
    vi.spyOn(studentsApi, 'getStudent').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('StudentProfilePage — header and Dados tab', () => {
  function mockReadyStudent() {
    vi.spyOn(studentsApi, 'getStudent').mockResolvedValue({
      ok: true,
      student: {
        id: 'student-1',
        fullName: 'Marina Costa',
        email: 'marina@teste.com',
        phone: '(48) 99123-4567',
        birthDate: '1996-02-14',
        cpf: '111.111.111-11',
        observations: 'Lesão no ombro direito',
        status: 'active',
      },
    })
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockResolvedValue({ ok: true, skillLevels: [] })
  }

  it('renders the header (name, status badge, email/phone) and Dados fields', async () => {
    mockPermissions({ 'alunos:read': true, 'alunos:write': true })
    mockReadyStudent()

    renderPage()

    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText(/marina@teste.com/)).toBeInTheDocument()
    expect(screen.getByText('14/02/1996')).toBeInTheDocument()
    expect(screen.getByText('111.111.111-11')).toBeInTheDocument()
    expect(screen.getByText('Lesão no ombro direito')).toBeInTheDocument()
    // A seção de nível por esporte (BEAC-1856) é hospedada na mesma aba.
    expect(screen.getByText('Nível por esporte')).toBeInTheDocument()
  })

  it('does not render a single "Nível"/"Esportes" kv row (replaced by the dedicated section)', async () => {
    mockPermissions({ 'alunos:read': true, 'alunos:write': true })
    mockReadyStudent()

    renderPage()

    await screen.findByText('Marina Costa')
    expect(screen.queryByText('Esportes')).not.toBeInTheDocument()
    expect(screen.queryByText('Nível')).not.toBeInTheDocument()
  })

  it('hides the Plano/Faturas tabs without financeiro:read', async () => {
    mockPermissions({ 'alunos:read': true, 'alunos:write': true, 'financeiro:read': false })
    mockReadyStudent()

    renderPage()

    await screen.findByText('Marina Costa')
    expect(screen.queryByRole('tab', { name: 'Plano' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Faturas' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Turmas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Progresso' })).toBeInTheDocument()
  })

  it('shows the Plano/Faturas tabs with financeiro:read, as "Em breve" stubs', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    mockPermissions({ 'alunos:read': true, 'alunos:write': true, 'financeiro:read': true })
    mockReadyStudent()

    renderPage()

    await screen.findByText('Marina Costa')
    const planoTab = screen.getByRole('tab', { name: 'Plano' })
    expect(planoTab).toBeInTheDocument()
    await userEvent.click(planoTab)
    expect(screen.getByText('Em breve.')).toBeInTheDocument()
  })

  it('hosts the real class-history section under the Turmas tab (BEAC-1864, no longer "Em breve")', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    mockPermissions({ 'alunos:read': true, 'alunos:write': true })
    mockReadyStudent()
    vi.spyOn(classHistoryApi, 'listClassHistory').mockResolvedValue({
      ok: true,
      classHistory: [
        {
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
        },
      ],
    })

    renderPage()

    await screen.findByText('Marina Costa')
    await userEvent.click(screen.getByRole('tab', { name: 'Turmas' }))

    expect(await screen.findByText('BT intermediária')).toBeInTheDocument()
    expect(screen.getByText('ter & qui 18:00 · Prof. Marcus Lima')).toBeInTheDocument()
  })
})
