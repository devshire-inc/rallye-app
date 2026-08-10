import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking } from '../../lib/api/bookings'
import * as meApi from '../../lib/api/me'
import * as tenantContext from '../../lib/tenantContext'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import AG4TeacherAgendaPage from './AG4TeacherAgendaPage'
import { bookingSubtitle } from './agendaShared'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

/** Uma hora cheia de HOJE dentro da janela da timeline (GRID_START_HOUR 6 /
 * GRID_END_HOUR 22) — a timeline só desenha o que cai dentro dela, então
 * `new Date()` cru quebraria o teste às 5h da manhã ou às 23h. */
function todayAt(hour: number, minute = 0): Date {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

function booking(overrides: Partial<Booking> = {}): Booking {
  const start = todayAt(9)
  return {
    id: 'b1',
    courtId: 'c1',
    courtName: 'Quadra 2',
    type: 'class_occurrence',
    classId: 'cl1',
    className: 'Beach tennis intermediária',
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3600_000).toISOString(),
    status: 'confirmed',
    teacherName: 'Marcus Lima',
    studentName: null,
    responsibleName: null,
    reason: null,
    unitId: 'unit-1',
    unitName: 'Arena Areia Dourada',
    checkedIn: false,
    studentCount: 6,
    ...overrides,
  }
}

/** Uma aula começando AGORA cai dentro da janela de check-in (15min antes /
 * 30min depois), mas precisa continuar dentro da timeline — por isso o
 * relógio é fixado numa hora segura em vez de usar a hora real da máquina. */
function inWindowBooking(overrides: Partial<Booking> = {}): Booking {
  return booking({ startAt: new Date().toISOString(), ...overrides })
}

beforeEach(() => {
  navigate.mockClear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(todayAt(9))
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'teacher-1', fullName: 'Usuária de Teste' })
  vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/agenda/professor']}>
      <Routes>
        <Route path="/units/:unitId/agenda/professor" element={<AG4TeacherAgendaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('bookingSubtitle', () => {
  it('usa a contagem que já vem no booking, com plural', () => {
    expect(bookingSubtitle(booking({ studentCount: 6 }), false)).toBe('Quadra 2 · 6 alunos')
  })

  it('usa o singular para uma aula com um aluno só', () => {
    expect(bookingSubtitle(booking({ studentCount: 1 }), false)).toBe('Quadra 2 · 1 aluno')
  })

  it('diz "individual" na aula particular, onde studentCount é 0 por contrato', () => {
    expect(bookingSubtitle(booking({ type: 'private', studentCount: 0 }), false)).toBe(
      'Quadra 2 · individual',
    )
  })

  it('prefixa a arena só quando pedido (professor cross-arena)', () => {
    expect(bookingSubtitle(booking(), true)).toBe('Arena Areia Dourada · Quadra 2 · 6 alunos')
  })
})

describe('AG4TeacherAgendaPage — timeline do dia', () => {
  it('abre na aba Hoje e desenha a aula como bloco da timeline', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()

    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
    expect(screen.getByTestId('agenda-mobile-event-b1')).toBeInTheDocument()
  })

  it('mostra a contagem de alunos no bloco, sem uma chamada por aula', async () => {
    const grid = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking({ studentCount: 6 })] })
    const participants = vi.spyOn(bookingsApi, 'listBookingParticipants')

    renderPage()

    expect(await screen.findByText('Quadra 2 · 6 alunos')).toBeInTheDocument()
    // 1 membership -> exatamente 1 chamada de grid, e NENHUMA de participantes
    // (o N+1 que o dado agregado `studentCount` existe para evitar).
    expect(grid).toHaveBeenCalledTimes(1)
    expect(participants).not.toHaveBeenCalled()
  })

  it('mostra o aluno no título e "individual" no subtítulo da aula particular', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({ type: 'private', classId: null, className: null, studentName: 'João Pedro', studentCount: 0 }),
      ],
    })

    renderPage()

    expect(await screen.findByText('Particular · João Pedro')).toBeInTheDocument()
    expect(screen.getByText('Quadra 2 · individual')).toBeInTheDocument()
    expect(screen.queryByText(/0 alunos/)).not.toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há aula no dia', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    expect(await screen.findByText('Dia livre!')).toBeInTheDocument()
  })

  it('avisa quando UMA das arenas falha, sem esconder o que veio', async () => {
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockImplementation(async (unitId) =>
      unitId === 'unit-1'
        ? { ok: true, viewOnly: false, bookings: [booking()] }
        : { ok: false, status: 403, error: 'forbidden' },
    )

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Uma das suas arenas não respondeu (1 de 2)',
    )
    expect(screen.getByTestId('agenda-mobile-event-b1')).toBeInTheDocument()
  })

  it('reporta erro quando TODAS as arenas falham', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: false, status: 500, error: 'boom' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar sua agenda.')
  })
})

describe('AG4TeacherAgendaPage — check-in dentro do bloco (desvio do frame)', () => {
  it('mostra a ação Check-in no bloco quando a aula está na janela', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [inWindowBooking({ checkedIn: false })],
    })

    renderPage()

    const event = await screen.findByTestId('agenda-mobile-event-b1')
    expect(within(event).getByRole('button', { name: /^Check-in/ })).toBeInTheDocument()
  })

  it('deixa o bloco LIMPO fora da janela de check-in', async () => {
    // 3h à frente: fora dos 15min anteriores ao início.
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ startAt: todayAt(12).toISOString(), endAt: todayAt(13).toISOString() })],
    })

    renderPage()

    const event = await screen.findByTestId('agenda-mobile-event-b1')
    expect(within(event).queryByRole('button', { name: /Check-in/ })).not.toBeInTheDocument()
    expect(within(event).queryByText(/Check-in feito/)).not.toBeInTheDocument()
  })

  it('mostra o selo "✅ Check-in feito" e nenhuma ação quando já houve check-in', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [inWindowBooking({ checkedIn: true })],
    })

    renderPage()

    expect(await screen.findByText('✅ Check-in feito')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Check-in/ })).not.toBeInTheDocument()
  })

  it('a ação leva para o check-in da reserva, na arena DELA', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [inWindowBooking({ unitId: 'unit-9' })],
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Check-in/ }))

    expect(navigate).toHaveBeenCalledWith(
      '/units/unit-9/bookings/b1/checkin',
      expect.objectContaining({ state: expect.anything() }),
    )
  })

  it('a ação de check-in NÃO abre o sheet de alunos junto', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [inWindowBooking()],
    })
    const participants = vi.spyOn(bookingsApi, 'listBookingParticipants')

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Check-in/ }))

    expect(participants).not.toHaveBeenCalled()
  })

  it('a janela abre sozinha com a passagem do tempo, sem recarregar a tela', async () => {
    // Aula às 10h: às 9h está fora da janela; às 9h50 entra nela.
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ startAt: todayAt(10).toISOString(), endAt: todayAt(11).toISOString() })],
    })

    renderPage()
    await screen.findByTestId('agenda-mobile-event-b1')
    expect(screen.queryByRole('button', { name: /^Check-in/ })).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(50 * 60 * 1000)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Check-in/ })).toBeInTheDocument(),
    )
  })
})

describe('AG4TeacherAgendaPage — cross-arena', () => {
  function twoArenas(sameHour: boolean) {
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockImplementation(async (unitId) => {
      if (unitId === 'unit-1') {
        return {
          ok: true,
          viewOnly: false,
          bookings: [booking({ id: 'b1', unitId: 'unit-1', unitName: 'Arena Areia Dourada' })],
        }
      }
      const start = sameHour ? todayAt(9) : todayAt(11)
      return {
        ok: true,
        viewOnly: false,
        bookings: [
          booking({
            id: 'b2',
            unitId: 'unit-2',
            unitName: 'Arena Praia Sul',
            className: 'Padel Avançado',
            courtId: 'c9',
            courtName: 'Quadra 1',
            startAt: start.toISOString(),
            endAt: new Date(start.getTime() + 3600_000).toISOString(),
          }),
        ],
      }
    })
  }

  it('junta as arenas numa timeline só e nomeia a arena DENTRO do bloco', async () => {
    twoArenas(false)

    renderPage()

    expect(await screen.findByText('Arena Areia Dourada · Quadra 2 · 6 alunos')).toBeInTheDocument()
    expect(screen.getByText('Arena Praia Sul · Quadra 1 · 6 alunos')).toBeInTheDocument()
  })

  it('reparte em colunas duas aulas no MESMO horário em arenas diferentes', async () => {
    twoArenas(true)

    const b1 = await screen.findByTestId('agenda-mobile-event-b1', undefined, { container: renderPage().container })
    const b2 = screen.getByTestId('agenda-mobile-event-b2')

    expect(b1).toHaveClass('agenda-mobile__event--laned')
    expect(b2).toHaveClass('agenda-mobile__event--laned')
    expect(b1.style.getPropertyValue('--agenda-mobile-event-lane-left')).toBe('0')
    expect(b2.style.getPropertyValue('--agenda-mobile-event-lane-left')).toBe('0.5')
  })

  it('professor de arena única NÃO vê o nome da arena repetido no bloco', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()

    expect(await screen.findByText('Quadra 2 · 6 alunos')).toBeInTheDocument()
  })

  it('os chips filtram ARENA quando há mais de uma, e QUADRA quando há uma só', async () => {
    twoArenas(false)
    const { unmount } = renderPage()

    const arenaRow = await screen.findByRole('group', { name: 'Filtrar por arena' })
    expect(within(arenaRow).getByRole('button', { name: 'Arena Areia Dourada' })).toBeInTheDocument()
    expect(within(arenaRow).getByRole('button', { name: 'Arena Praia Sul' })).toBeInTheDocument()
    unmount()

    vi.restoreAllMocks()
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'teacher-1', fullName: 'Usuária de Teste' })
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking(), booking({ id: 'b3', courtId: 'c3', courtName: 'Quadra 5' })],
    })
    renderPage()

    const courtRow = await screen.findByRole('group', { name: 'Filtrar por quadra' })
    expect(within(courtRow).getByRole('button', { name: 'Quadra 2' })).toBeInTheDocument()
    expect(within(courtRow).getByRole('button', { name: 'Quadra 5' })).toBeInTheDocument()
  })

  it('não mostra a filterRow quando o dia inteiro é numa quadra só (frame 35:1096)', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()

    await screen.findByTestId('agenda-mobile-event-b1')
    expect(screen.queryByRole('group', { name: 'Filtrar por quadra' })).not.toBeInTheDocument()
  })

  it('o chip de arena esconde as aulas das outras arenas', async () => {
    twoArenas(false)

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Arena Praia Sul' }))

    await waitFor(() => expect(screen.queryByTestId('agenda-mobile-event-b1')).not.toBeInTheDocument())
    expect(screen.getByTestId('agenda-mobile-event-b2')).toBeInTheDocument()
  })
})

describe('AG4TeacherAgendaPage — abas Hoje/Semana', () => {
  it('troca para Semana e agrupa por dia numa lista, não numa timeline', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    const { container } = renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Semana' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true'))
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
    expect(container.querySelector('.agenda-mobile__timeline')).toBeNull()
    expect(container.querySelector('.ag4-week-row')).not.toBeNull()
  })

  it('a lista da semana busca a janela de semana, não a de dia', async () => {
    const grid = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()
    await screen.findByTestId('agenda-mobile-event-b1')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Semana' }))

    await waitFor(() => {
      const [, from, to] = grid.mock.calls.at(-1)!
      expect(new Date(to!).getTime() - new Date(from!).getTime()).toBe(7 * 24 * 3600_000)
    })
  })

  it('mantém a ação de check-in na lista da semana', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [inWindowBooking()],
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Semana' }))

    expect(await screen.findByRole('button', { name: /^Check-in/ })).toBeInTheDocument()
  })

  it('mostra o estado vazio da semana quando não há aula nenhuma', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Semana' }))

    expect(await screen.findByText('Semana livre')).toBeInTheDocument()
  })
})

describe('AG4TeacherAgendaPage — sheet "Alunos da Aula"', () => {
  it('abre tocando o bloco da aula e lista os participantes com o nível real', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [
        {
          id: 'p1',
          bookingId: 'b1',
          studentId: 's1',
          studentName: 'Marina Costa',
          source: 'manual',
          attendanceStatus: null,
          checkedInAt: null,
          tier: 'b',
        },
      ],
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Beach tennis intermediária'))

    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('navega para o aluno pelo sheet', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [
        {
          id: 'p1',
          bookingId: 'b1',
          studentId: 's1',
          studentName: 'Marina Costa',
          source: 'manual',
          attendanceStatus: null,
          checkedInAt: null,
          tier: 'b',
        },
      ],
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Beach tennis intermediária'))
    await user.click(await screen.findByText('Marina Costa'))

    expect(navigate).toHaveBeenCalledWith('/units/unit-1/students/s1')
  })

  it('mostra o nome do aluno na aula particular, cuja lista de participantes é vazia por contrato', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({ type: 'private', classId: null, className: null, studentName: 'João Pedro', studentCount: 0 }),
      ],
    })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [] })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Particular · João Pedro'))

    const note = await screen.findByText('João Pedro', { selector: '.ag4-participants-note' })
    expect(note).toBeInTheDocument()
  })

  it('reporta erro quando a lista de participantes falha', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'boom',
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Beach tennis intermediária'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a lista de alunos.')
  })
})

describe('AG4TeacherAgendaPage — solicitar bloqueio', () => {
  it('pluga TeacherBlockRequestButton no slot de ação assim que a identidade resolve', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    const { container } = renderPage()

    const trigger = await screen.findByRole('button', { name: 'Solicitar bloqueio' })
    expect(container.querySelector('.agenda-mobile__action--slot')).toContainElement(trigger)
  })
})
