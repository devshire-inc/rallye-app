import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../hooks/usePermission'
import * as pendingApprovalsApi from '../lib/api/pendingApprovals'
import type { PendingApprovalItem } from '../lib/api/pendingApprovals'
import * as teachersApi from '../lib/api/teachers'
import { PendingApprovalsCard } from './PendingApprovalsCard'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function teacherBlockItem(overrides: Partial<PendingApprovalItem> = {}): PendingApprovalItem {
  return {
    id: 'pa-block-1',
    type: 'teacher_block',
    status: 'pending',
    requestedBy: 'teacher-1',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-07-20T10:00:00Z',
    teacherBlock: {
      teacherId: 'teacher-1',
      teacherName: 'Marcus Lima',
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-03T00:00:00Z',
      reason: 'Consulta médica',
    },
    reschedule: null,
    ...overrides,
  }
}

function rescheduleItem(overrides: Partial<PendingApprovalItem> = {}): PendingApprovalItem {
  return {
    id: 'pa-reschedule-1',
    type: 'reschedule',
    status: 'pending',
    requestedBy: 'student-1',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-07-20T11:00:00Z',
    teacherBlock: null,
    reschedule: {
      studentId: 'student-1',
      studentName: 'Ana Beltrão',
      targetClassName: 'BT sexta 18h',
      targetStartAt: '2026-08-01T18:00:00Z',
    },
    ...overrides,
  }
}

describe('PendingApprovalsCard — permissão (esconder sempre, nunca desabilitar)', () => {
  it('não renderiza nada sem read:agenda nem read:professores', () => {
    mockPermissions({})
    const listSpy = vi.spyOn(pendingApprovalsApi, 'listPendingApprovals')

    const { container } = render(<PendingApprovalsCard unitId="unit-1" />)

    expect(container).toBeEmptyDOMElement()
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('renderiza com read:agenda sozinho', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })

    render(<PendingApprovalsCard unitId="unit-1" />)

    expect(await screen.findByText('Central de Pendências')).toBeInTheDocument()
  })

  it('renderiza com read:professores sozinho', async () => {
    mockPermissions({ 'professores:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })

    render(<PendingApprovalsCard unitId="unit-1" />)

    expect(await screen.findByText('Central de Pendências')).toBeInTheDocument()
  })
})

describe('PendingApprovalsCard — esconde quando não há pendências', () => {
  it('não renderiza nada quando a lista vem vazia', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({ ok: true, items: [] })

    const { container } = render(<PendingApprovalsCard unitId="unit-1" />)

    await vi.waitFor(() => expect(container.querySelector('.pend-card')).toBeNull())
  })
})

describe('PendingApprovalsCard — conteúdo misto', () => {
  it('mostra o badge com a contagem e os dois tipos de item ao expandir', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem(), rescheduleItem()],
    })

    render(<PendingApprovalsCard unitId="unit-1" />)

    expect(await screen.findByText('2')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /central de pendências/i }))

    expect(screen.getByText('Bloqueio de horário · Prof. Marcus Lima')).toBeInTheDocument()
    expect(screen.getByText(/Consulta médica/)).toBeInTheDocument()
    expect(screen.getByText('Remarcação · Ana Beltrão')).toBeInTheDocument()
    expect(screen.getByText(/BT sexta 18h/)).toBeInTheDocument()
  })
})

describe('PendingApprovalsCard — decisão de reschedule (1 clique)', () => {
  it('Aprovar chama decideRescheduleCredit(approve) e remove o item', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [rescheduleItem()],
    })
    const decideSpy = vi
      .spyOn(pendingApprovalsApi, 'decideRescheduleCredit')
      .mockResolvedValue({ ok: true, status: 'approved' })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))

    expect(decideSpy).toHaveBeenCalledWith('pa-reschedule-1', 'approve')
    await vi.waitFor(() => expect(screen.queryByText('Remarcação · Ana Beltrão')).not.toBeInTheDocument())
  })

  it('Recusar chama decideRescheduleCredit(reject)', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [rescheduleItem()],
    })
    const decideSpy = vi
      .spyOn(pendingApprovalsApi, 'decideRescheduleCredit')
      .mockResolvedValue({ ok: true, status: 'rejected' })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    expect(decideSpy).toHaveBeenCalledWith('pa-reschedule-1', 'reject')
  })
})

describe('PendingApprovalsCard — decisão de teacher_block', () => {
  it('Recusar é 1 clique direto (decideTeacherBlockRequest reject)', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })
    const decideSpy = vi
      .spyOn(pendingApprovalsApi, 'decideTeacherBlockRequest')
      .mockResolvedValue({ ok: true, status: 'rejected', affectedBookings: 0, creditsGranted: 0 })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Recusar' }))

    expect(decideSpy).toHaveBeenCalledWith('pa-block-1', 'reject')
  })

  it('Aprovar abre o BlockRequestDecisionSheet (não decide direto)', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })
    const decideSpy = vi.spyOn(pendingApprovalsApi, 'decideTeacherBlockRequest')
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({ ok: true, teachers: [] })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Bloqueio de horário · Marcus Lima')).toBeInTheDocument()
    expect(screen.getByText('Cancelar aula(s)')).toBeInTheDocument()
    expect(screen.getByText('Substituir professor')).toBeInTheDocument()
    expect(decideSpy).not.toHaveBeenCalled()
  })

  it('escolher "Cancelar aula(s)" no sheet chama approve_cancel e fecha', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })
    const decideSpy = vi
      .spyOn(pendingApprovalsApi, 'decideTeacherBlockRequest')
      .mockResolvedValue({ ok: true, status: 'approved_cancelled', affectedBookings: 2, creditsGranted: 3 })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    await user.click(await screen.findByText('Cancelar aula(s)'))

    expect(decideSpy).toHaveBeenCalledWith('pa-block-1', 'approve_cancel')
    await vi.waitFor(() =>
      expect(screen.queryByText('Bloqueio de horário · Prof. Marcus Lima')).not.toBeInTheDocument(),
    )
  })

  it('escolher "Substituir professor" mostra o picker e confirmar chama approve_substitute', async () => {
    mockPermissions({ 'agenda:read': true })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [teacherBlockItem()],
    })
    vi.spyOn(teachersApi, 'listTeachers').mockResolvedValue({
      ok: true,
      teachers: [
        {
          id: 'teacher-2',
          fullName: 'Ana Substituta',
          email: 'ana@example.com',
          phone: null,
          sports: ['beach_tennis'],
          remunerationModel: 'fixed',
          remunerationValue: 3000,
          status: 'active',
          turmasCount: 0,
        },
      ],
    })
    const decideSpy = vi
      .spyOn(pendingApprovalsApi, 'decideTeacherBlockRequest')
      .mockResolvedValue({ ok: true, status: 'approved_substituted', affectedBookings: 1, creditsGranted: 0 })

    render(<PendingApprovalsCard unitId="unit-1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /central de pendências/i }))
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    await user.click(await screen.findByText('Substituir professor'))

    const select = await screen.findByLabelText('Professor substituto')
    await user.selectOptions(select, 'teacher-2')
    await user.click(screen.getByRole('button', { name: 'Confirmar substituição' }))

    expect(decideSpy).toHaveBeenCalledWith('pa-block-1', 'approve_substitute', 'teacher-2')
  })
})
