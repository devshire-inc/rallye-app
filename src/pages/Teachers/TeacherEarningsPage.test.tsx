import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as earningsApi from '../../lib/api/earnings'
import type { Earnings } from '../../lib/api/earnings'
import * as teachersApi from '../../lib/api/teachers'
import type { Teacher } from '../../lib/api/teachers'
import TeacherEarningsPage from './TeacherEarningsPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function teacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: 'teacher-1',
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
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/teachers/${teacherId}/earnings`]}>
      <Routes>
        <Route
          path="/units/:unitId/teachers/:teacherId/earnings"
          element={<TeacherEarningsPage />}
        />
        <Route
          path="/units/:unitId/teachers/:teacherId"
          element={<div>Perfil do professor placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeacherEarningsPage — loading e erro', () => {
  it('mostra status de carregamento', () => {
    vi.spyOn(earningsApi, 'getEarnings').mockReturnValue(new Promise(() => {}))
    vi.spyOn(teachersApi, 'getTeacher').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: '' })).toBeInTheDocument()
  })

  it('mostra erro quando a API falha', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: false, status: 500, error: 'x' })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('TeacherEarningsPage — conteúdo (BEAC-1700/BEAC-1884)', () => {
  it('mostra o toast somente-leitura com a cópia exata', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()

    expect(
      await screen.findByText(
        'Somente leitura — os valores são calculados automaticamente pelo sistema (fechamento mensal) e conferidos pelo admin.',
      ),
    ).toBeInTheDocument()
  })

  it('renderiza o stat4 com Modelo/Aulas dadas/A receber/Já recebido mapeados de classes_given_in_period/pending_amount/paid_amount', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'commission', remunerationValue: 30 }),
    })

    renderPage()

    expect(await screen.findByText('Comissão 30%')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.240,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 2.480,00')).toBeInTheDocument()
  })

  it('renderiza os 6 meses do histórico (diferente do PR2/Comissão, que usa só 3)', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()

    await screen.findByText('Histórico mensal')
    expect(screen.getByText('fev')).toBeInTheDocument()
    expect(screen.getByText('mar')).toBeInTheDocument()
    expect(screen.getByText('abr')).toBeInTheDocument()
    expect(screen.getByText('mai')).toBeInTheDocument()
    expect(screen.getByText('jun')).toBeInTheDocument()
    expect(screen.getByText('jul')).toBeInTheDocument()
  })

  it('seleciona o mês mais recente por padrão e permite navegar entre os meses do histórico', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()
    await screen.findByText('Histórico mensal')

    const julTab = screen.getByRole('tab', { name: 'Julho 2026' })
    expect(julTab).toHaveAttribute('aria-selected', 'true')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Maio 2026' }))

    expect(screen.getByRole('tab', { name: 'Maio 2026' })).toHaveAttribute('aria-selected', 'true')
    expect(julTab).toHaveAttribute('aria-selected', 'false')
  })

  it('renderiza o detalhamento de turma quando breakdown[] não está vazio (BEAC-1701/BEAC-1886)', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({
        remunerationModel: 'per_class',
        breakdown: [
          { classId: 'class-1', className: 'BT intermediária', classCount: 18, amount: 1620 },
          { classId: 'class-2', className: 'Particulares', classCount: 1, amount: 90 },
        ],
      }),
    })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'per_class', remunerationValue: 90 }),
    })

    renderPage()

    expect(await screen.findByText('Detalhamento do mês atual')).toBeInTheDocument()
    expect(screen.getByText('BT intermediária')).toBeInTheDocument()
    expect(screen.getByText('18 aulas')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.620,00')).toBeInTheDocument()
    expect(screen.getByText('Particulares')).toBeInTheDocument()
    expect(screen.getByText('1 aula')).toBeInTheDocument()
    // Sem "alunos/aula em média" — sem fonte de dado real (AC desta task).
    expect(screen.queryByText(/alunos\/aula/i)).not.toBeInTheDocument()
  })

  it('mostra o motivo do gap quando breakdown[] está vazio para fixed', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({ remunerationModel: 'fixed', breakdown: [] }),
    })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'fixed', remunerationValue: 3000 }),
    })

    renderPage()

    expect(
      await screen.findByText(/não disponível para o modelo de remuneração fixo/i),
    ).toBeInTheDocument()
  })

  it('mostra o motivo do gap quando breakdown[] está vazio para commission', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({ remunerationModel: 'commission', breakdown: [] }),
    })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'commission', remunerationValue: 30 }),
    })

    renderPage()

    expect(
      await screen.findByText(/não disponível para o modelo de comissão/i),
    ).toBeInTheDocument()
  })

  it('mostra "Nenhuma aula confirmada" quando breakdown[] está vazio para per_class', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({
      ok: true,
      earnings: earnings({ remunerationModel: 'per_class', breakdown: [] }),
    })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ remunerationModel: 'per_class', remunerationValue: 80 }),
    })

    renderPage()

    expect(await screen.findByText(/nenhuma aula confirmada neste mês/i)).toBeInTheDocument()
  })

  it('mostra o back-link para o perfil do professor (PF2 não existe ainda)', async () => {
    vi.spyOn(earningsApi, 'getEarnings').mockResolvedValue({ ok: true, earnings: earnings() })
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })

    renderPage()
    await screen.findByText('Histórico mensal')

    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: /meu perfil/i }))

    expect(await screen.findByText('Perfil do professor placeholder')).toBeInTheDocument()
  })
})
