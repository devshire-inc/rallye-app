import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as bookingsApi from '../../lib/api/bookings'
import * as meApi from '../../lib/api/me'
import * as membersApi from '../../lib/api/members'
import type { Booking, Participant } from '../../lib/api/bookings'
import AG5BookingDetailPage from './AG5BookingDetailPage'

beforeEach(() => {
  // Default: GET /me resolves normally (BEAC-1912, sheet AG7 "Remarcar" —
  // mesmo padrão de AG3StudentAgendaPage.test.tsx) — this page now calls
  // getMe() to resolve the caller's own profile id for the self-only
  // POST /students/{id}/reschedule endpoint.
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'self-student-id' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

type PermissionMap = Record<string, boolean>

function mockPermissions(map: PermissionMap) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

const booking: Booking = {
  id: 'b1',
  courtId: 'c1',
  courtName: 'Quadra 2',
  type: 'class_occurrence',
  classId: 'cl1',
  className: 'BT intermediária',
  startAt: '2026-07-10T18:00:00Z',
  endAt: '2026-07-10T19:00:00Z',
  status: 'confirmed',
  teacherName: 'Marcus Lima',
  studentName: null,
  responsibleName: null,
  reason: null,
  unitId: 'unit-1',
  unitName: 'Arena Areia Dourada',
  checkedIn: false,
  studentCount: 1,
}

function renderWithState(state: { booking?: Booking } | null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/units/unit-1/bookings/b1', state }]}>
      <Routes>
        <Route path="/units/:unitId/bookings/:bookingId" element={<AG5BookingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AG5BookingDetailPage', () => {
  it('shows a clear message instead of crashing when opened without router state (deep link gap)', () => {
    mockPermissions({})
    renderWithState(null)

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar os detalhes/i)
  })

  it('renders header fields (título, horário, quadra, status) when the booking is available', () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true })
    renderWithState({ booking })

    expect(screen.getByText('BT intermediária')).toBeInTheDocument()
    expect(screen.getByText('Quadra 2')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('shows only the Admin "Ações" entry point when agenda:write is present', () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true })
    renderWithState({ booking })

    expect(screen.getByRole('button', { name: 'Ações' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument()
  })

  it('shows the Aluno actions (Remarcar, Cancelar presença) without alunos:read/agenda:write', () => {
    mockPermissions({})
    renderWithState({ booking })

    expect(screen.getByRole('button', { name: 'Remarcar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar presença' })).toBeInTheDocument()
  })

  it('shows the Professor actions (Check-in, Feedback, Ver perfil) for the isProfessor branch (alunos:read without agenda:write)', () => {
    // NOTA (correção de review, BEAC-1707/1918): a matriz de seed real
    // (migrations/000016) dá agenda:write PARA Professor também (agenda
    // própria, self-service) — então isAdmin = usePermission('agenda',
    // 'write') é true para um Professor real, e este branch (isProfessor =
    // isStaff && !isAdmin) nunca é alcançado por um Professor de verdade.
    // Esse é o mesmo gap heurístico JÁ documentado no comentário de pacote
    // de AG5BookingDetailPage.tsx ("sem sinal de papel confiável") — fora do
    // escopo desta correção (que é só o gate do botão Adicionar aluno, ver
    // describe abaixo). Este teste continua existindo para cobrir o branch
    // isProfessor em si (código morto para usuários reais hoje, mas ainda
    // faz parte do componente) — não afirma que esta combinação de
    // permissão corresponde a um Professor real; ver o teste seguinte
    // ("com as permissões REAIS de um Professor...") para o cenário
    // realista.
    mockPermissions({ 'alunos:read': true })
    renderWithState({ booking })

    expect(screen.getByRole('button', { name: 'Abrir Check-in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dar Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver perfil aluno' })).toBeInTheDocument()
  })

  it('with the REAL Professor permissions (agenda:write true too, migrations/000016), falls into the isAdmin branch instead — known heuristic gap, not introduced by this correction', () => {
    mockPermissions({ 'alunos:read': true, 'agenda:write': true })
    renderWithState({ booking })

    expect(screen.getByRole('button', { name: 'Ações' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir Check-in' })).not.toBeInTheDocument()
  })
})

describe('AG5BookingDetailPage — "Adicionar aluno" (BEAC-1918, story BEAC-1707)', () => {
  // config:write: true nestes cenários representa um papel admin real (Unit
  // Admin/Tenant Owner/Platform Admin têm read+write em TODOS os módulos,
  // migrations/000016 — incluindo config), que é quem a busca de alunos
  // (GET /units/{id}/members, gated por config:write) de fato funciona para.
  it('shows the button inside Ações when the caller can also search students (config:write present, e.g. Unit Admin)', async () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true, 'config:write': true })
    renderWithState({ booking })

    await userEvent.click(screen.getByRole('button', { name: 'Ações' }))

    expect(screen.getByRole('button', { name: '👤 Adicionar aluno' })).toBeInTheDocument()
  })

  // Correção de review (achado do reviewer): GET /units/{id}/members (usado
  // pela busca do picker) exige config:write, não agenda:write. Professor
  // tem agenda:write (migrations/000016) mas NÃO config:write — sem este
  // teste, um Professor real veria o botão e a busca sempre devolveria 403
  // (fluxo sem saída, achado original do reviewer). O botão agora fica
  // escondido para essa combinação real de permissões.
  it('hides the button for the REAL Professor permission set (agenda:write true, config:write false) — the search would 403 otherwise', async () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true })
    renderWithState({ booking })

    await userEvent.click(screen.getByRole('button', { name: 'Ações' }))

    expect(screen.getByRole('button', { name: 'Ações' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '👤 Adicionar aluno' })).not.toBeInTheDocument()
  })

  it('does not show the button for a booking type that is not class_occurrence (no "capacidade da turma" concept)', async () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true, 'config:write': true })
    renderWithState({ booking: { ...booking, type: 'private', classId: null, className: null } })

    await userEvent.click(screen.getByRole('button', { name: 'Ações' }))

    expect(screen.queryByRole('button', { name: '👤 Adicionar aluno' })).not.toBeInTheDocument()
  })

  it('opens the student picker sheet and adds a student without a capacity warning', async () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true, 'config:write': true })
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: true,
      members: [
        {
          membershipId: 'membership-aluno-1',
          user: { id: 'student-1', name: 'João Pereira', email: 'joao@example.com', avatarUrl: null },
          role: { id: 'role-aluno', name: 'Aluno' },
        },
      ],
    })
    const participant: Participant = {
      id: 'participant-1',
      bookingId: 'b1',
      studentId: 'student-1',
      studentName: 'João Pereira',
      source: 'manual',
      addedBy: 'admin-1',
      addedAt: '2026-07-20T10:00:00Z',
      capacityWarning: false,
    }
    vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({ ok: true, participant })

    renderWithState({ booking })

    await userEvent.click(screen.getByRole('button', { name: 'Ações' }))
    await userEvent.click(screen.getByRole('button', { name: '👤 Adicionar aluno' }))

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    expect(await screen.findByRole('status')).toHaveTextContent('João Pereira adicionado à aula.')
  })

  it('surfaces the capacity warning message after the admin acknowledges it (avisa, não bloqueia)', async () => {
    mockPermissions({ 'agenda:write': true, 'alunos:read': true, 'config:write': true })
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
      ok: true,
      members: [
        {
          membershipId: 'membership-aluno-1',
          user: { id: 'student-1', name: 'João Pereira', email: 'joao@example.com', avatarUrl: null },
          role: { id: 'role-aluno', name: 'Aluno' },
        },
      ],
    })
    const participant: Participant = {
      id: 'participant-1',
      bookingId: 'b1',
      studentId: 'student-1',
      studentName: 'João Pereira',
      source: 'manual',
      addedBy: 'admin-1',
      addedAt: '2026-07-20T10:00:00Z',
      capacityWarning: true,
    }
    vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({ ok: true, participant })

    renderWithState({ booking })

    await userEvent.click(screen.getByRole('button', { name: 'Ações' }))
    await userEvent.click(screen.getByRole('button', { name: '👤 Adicionar aluno' }))

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/acima da capacidade recomendada/i)
    await userEvent.click(screen.getByRole('button', { name: 'Ok, entendi' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'João Pereira adicionado (turma acima da capacidade recomendada).',
    )
  })
})
