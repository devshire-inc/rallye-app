import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as earningsApi from '../../lib/api/earnings'
import type { Earnings } from '../../lib/api/earnings'
import * as meApi from '../../lib/api/me'
import * as teachersApi from '../../lib/api/teachers'
import type { Teacher } from '../../lib/api/teachers'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import MyEarningsPage from './MyEarningsPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function teacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: 'own-teacher-id',
    fullName: 'Marcus Lima',
    email: 'marcus@teste.com',
    phone: null,
    sports: ['beach_tennis'],
    remunerationModel: 'commission',
    remunerationValue: 30,
    certifications: null,
    bio: null,
    status: 'active',
    ...overrides,
  }
}

function earnings(overrides: Partial<Earnings> = {}): Earnings {
  return {
    remunerationModel: 'commission',
    classesGivenInPeriod: 42,
    revenueGenerated: 12400,
    pendingAmount: 1240,
    paidAmount: 2480,
    currentMonthAmount: 3720,
    history: [{ period: '2026-07-01', amount: 3720 }],
    breakdown: [],
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[`/units/${unitId}/me/earnings`]}>
      <Routes>
        <Route path="/units/:unitId/me/earnings" element={<MyEarningsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MyEarningsPage', () => {
  it('shows a loading status while resolving identity and earnings', () => {
    vi.spyOn(meApi, 'getMe').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: '' })).toBeInTheDocument()
  })

  it('resolves the teacher id via GET /me, never from props/URL, and fetches its own earnings', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'own-teacher-id', fullName: 'Marcus Lima' })
    const earningsSpy = vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    const teacherSpy = vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage('unit-99')

    await screen.findByText('Comissão 30%')
    expect(earningsSpy).toHaveBeenCalledWith('own-teacher-id')
    expect(teacherSpy).toHaveBeenCalledWith('own-teacher-id')
  })

  it('shows the same Earnings fields as TeacherEarningsPage (model/classes/pending/paid)', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'own-teacher-id', fullName: 'Marcus Lima' })
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()

    expect(await screen.findByText('Comissão 30%')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.240,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 2.480,00')).toBeInTheDocument()
  })

  it('shows an error state when GET /me fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: false, status: 403, error: 'forbidden' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })

  it('shows an error state when the earnings fetch fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'own-teacher-id', fullName: 'Marcus Lima' })
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: false, status: 500, error: 'x' })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})
