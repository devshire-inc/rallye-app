import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as membersApi from '../../lib/api/members'
import type { Member } from '../../lib/api/members'
import type { Participant } from '../../lib/api/bookings'
import { AddStudentSheet } from './AddStudentSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function student(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-aluno-1',
    user: { id: 'student-1', name: 'João Pereira', email: 'joao@example.com', avatarUrl: null },
    role: { id: 'role-aluno', name: 'Aluno' },
    ...overrides,
  }
}

function professor(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-prof-1',
    user: { id: 'prof-1', name: 'Marcus Lima', email: 'marcus@example.com', avatarUrl: null },
    role: { id: 'role-professor', name: 'Professor' },
    ...overrides,
  }
}

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'participant-1',
    bookingId: 'booking-1',
    studentId: 'student-1',
    studentName: 'João Pereira',
    source: 'manual',
    addedBy: 'admin-1',
    addedAt: '2026-07-20T10:00:00Z',
    capacityWarning: false,
    ...overrides,
  }
}

function renderSheet(onAdded = vi.fn(), onCancel = vi.fn()) {
  render(<AddStudentSheet unitId="unit-1" bookingId="booking-1" onAdded={onAdded} onCancel={onCancel} />)
  return { onAdded, onCancel }
}

describe('AddStudentSheet — search filters to Aluno role only', () => {
  it('lists only members with role Aluno, excluding other roles (e.g. Professor)', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [student(), professor()] })

    renderSheet()

    expect(await screen.findByText('João Pereira')).toBeInTheDocument()
    expect(screen.queryByText('Marcus Lima')).not.toBeInTheDocument()
  })

  it('shows a placeholder when no student matches', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderSheet()

    expect(await screen.findByText(/nenhum aluno encontrado/i)).toBeInTheDocument()
  })

  it('shows an error message when the search fails', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: false, status: 500, error: 'internal_error' })

    renderSheet()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível buscar alunos/i)
  })
})

describe('AddStudentSheet — adding a student within capacity', () => {
  it('calls addBookingParticipant and onAdded immediately when there is no capacity warning', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [student()] })
    const addSpy = vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({
      ok: true,
      participant: participant({ capacityWarning: false }),
    })
    const { onAdded } = renderSheet()

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    expect(addSpy).toHaveBeenCalledWith('booking-1', 'student-1')
    expect(onAdded).toHaveBeenCalledWith(participant({ capacityWarning: false }))
  })
})

describe('AddStudentSheet — capacity warning (BEAC-1918 AC: avisa, não bloqueia)', () => {
  it('shows the warning banner and only calls onAdded after acknowledging it', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [student()] })
    vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({
      ok: true,
      participant: participant({ capacityWarning: true }),
    })
    const { onAdded } = renderSheet()

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    const warning = await screen.findByRole('alert')
    expect(warning).toHaveTextContent(/acima da capacidade recomendada/i)
    // A adição já aconteceu no backend — onAdded ainda não foi chamado
    // enquanto o aviso não foi reconhecido.
    expect(onAdded).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ok, entendi' }))

    expect(onAdded).toHaveBeenCalledWith(participant({ capacityWarning: true }))
  })
})

describe('AddStudentSheet — errors adding a student', () => {
  it('shows a specific message on 409 already_participant without closing the sheet', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [student()] })
    vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'already_participant',
      message: 'aluno já foi adicionado a este booking',
    })
    const { onAdded } = renderSheet()

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    expect(await screen.findByText(/já foi adicionado a esta aula/i)).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('shows a generic error message on other failures', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [student()] })
    vi.spyOn(bookingsApi, 'addBookingParticipant').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'create_participant_failed',
    })
    renderSheet()

    await screen.findByText('João Pereira')
    await userEvent.click(screen.getByText('João Pereira'))

    expect(await screen.findByText(/não foi possível adicionar o aluno agora/i)).toBeInTheDocument()
  })
})

describe('AddStudentSheet — cancel', () => {
  it('calls onCancel when the Cancelar button is tapped', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })
    const { onCancel } = renderSheet()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalled()
  })
})
