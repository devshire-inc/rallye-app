import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as meApi from '../../lib/api/me'
import * as rescheduleApi from '../../lib/api/reschedule'
import * as waitlistApi from '../../lib/api/waitlist'
import AG3StudentAgendaPage from './AG3StudentAgendaPage'

beforeEach(() => {
  // Default: GET /me resolves normally — mirrors a logged-in Aluno session.
  // Overridden per-test when a specific id or failure mode matters.
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'self-student-id', fullName: 'Usuária de Teste' })
  // Default: 1 crédito disponível — mirrors the common case. Overridden
  // per-test for the 0-credits/error/loading scenarios.
  vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({
    ok: true,
    credits: [{ id: 'credit-1', grantedAt: new Date().toISOString(), expiresAt: new Date().toISOString(), sourceBookingId: 'b1' }],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/units/unit-1/agenda/minha']}>
      <Routes>
        <Route path="/units/:unitId/agenda/minha" element={<AG3StudentAgendaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// renderPageWithOffer simula chegar nesta página por um deep link de
// notificação vaga_waitlist (BEAC-1724/BEAC-2023): resolveNotificationRoute
// (notificationRouting.ts) monta exatamente esta URL.
function renderPageWithOffer(entryId: string) {
  return render(
    <MemoryRouter initialEntries={[`/units/unit-1/agenda/minha?offer=${entryId}`]}>
      <Routes>
        <Route path="/units/:unitId/agenda/minha" element={<AG3StudentAgendaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const OFFER_DETAIL_FIXTURE = {
  ok: true as const,
  entryId: 'entry-1',
  classId: 'class-1',
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  className: 'Turma Beach Tennis',
  courtName: 'Quadra 2',
  teacherName: 'Duda Rocha',
  activeEnrollments: 7,
  capacity: 8,
  nextOccurrenceAt: null,
}

describe('AG3StudentAgendaPage', () => {
  it('defaults to the "Próximas" tab and lists upcoming bookings grouped by date', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        {
          id: 'b1',
          courtId: 'c1',
          courtName: 'Quadra 2',
          type: 'class_occurrence',
          classId: 'cl1',
          className: 'Beach tennis intermediária',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600_000).toISOString(),
          status: 'confirmed',
          teacherName: 'Marcus Lima',
          studentName: null,
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Arena Areia Dourada',
          checkedIn: false,
          studentCount: 1,
        },
      ],
    })

    renderPage()

    expect(screen.getByRole('tab', { name: 'Próximas' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('does NOT show the old fixed "Remarcações usadas este mês: 1/2" text, and shows the real credit count instead (BEAC-1706)', async () => {
    const gridSpy = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByText('1 crédito disponível este mês')).toBeInTheDocument()
    expect(screen.queryByText(/Remarcações usadas este mês/)).not.toBeInTheDocument()
    expect(screen.queryByText(/TODO\(BEAC-1706\)/)).not.toBeInTheDocument()
    // Ver comentário no teste "switches to Histórico" — espera a cadeia
    // getMe -> getBookingsGrid assentar antes do teste terminar/desmontar.
    await waitFor(() => expect(gridSpy).toHaveBeenCalled())
  })

  it('shows the plural credit count in the footer when more than 1 credit is available', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({
      ok: true,
      credits: [
        { id: 'credit-1', grantedAt: new Date().toISOString(), expiresAt: new Date().toISOString(), sourceBookingId: 'b1' },
        { id: 'credit-2', grantedAt: new Date().toISOString(), expiresAt: new Date().toISOString(), sourceBookingId: 'b2' },
      ],
    })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByText('2 créditos disponíveis este mês')).toBeInTheDocument()
  })

  it('disables "Remarcar" with an explanatory tooltip when the student has no reschedule credits available', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({ ok: true, credits: [] })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        {
          id: 'b1',
          courtId: 'c1',
          courtName: 'Quadra 2',
          type: 'class_occurrence',
          classId: 'cl1',
          className: 'Beach tennis intermediária',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600_000).toISOString(),
          status: 'confirmed',
          teacherName: 'Marcus Lima',
          studentName: null,
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Arena Areia Dourada',
          checkedIn: false,
          studentCount: 1,
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('0 créditos disponíveis este mês')).toBeInTheDocument()
    const remarcarButton = await screen.findByRole('button', { name: 'Remarcar' })
    expect(remarcarButton).toBeDisabled()
    expect(remarcarButton).toHaveAttribute('title', expect.stringMatching(/crédito/i))
  })

  it('keeps "Remarcar" enabled without a tooltip when the student has credits available', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        {
          id: 'b1',
          courtId: 'c1',
          courtName: 'Quadra 2',
          type: 'class_occurrence',
          classId: 'cl1',
          className: 'Beach tennis intermediária',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600_000).toISOString(),
          status: 'confirmed',
          teacherName: 'Marcus Lima',
          studentName: null,
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Arena Areia Dourada',
          checkedIn: false,
          studentCount: 1,
        },
      ],
    })

    renderPage()

    const remarcarButton = await screen.findByRole('button', { name: 'Remarcar' })
    await waitFor(() => expect(screen.getByText('1 crédito disponível este mês')).toBeInTheDocument())
    expect(remarcarButton).not.toBeDisabled()
    expect(remarcarButton).not.toHaveAttribute('title')
  })

  it('does not disable "Remarcar" while credits are still loading or if the credits fetch fails (fail-open)', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({ ok: false, status: 500, error: 'server_error' })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        {
          id: 'b1',
          courtId: 'c1',
          courtName: 'Quadra 2',
          type: 'class_occurrence',
          classId: 'cl1',
          className: 'Beach tennis intermediária',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600_000).toISOString(),
          status: 'confirmed',
          teacherName: 'Marcus Lima',
          studentName: null,
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Arena Areia Dourada',
          checkedIn: false,
          studentCount: 1,
        },
      ],
    })

    renderPage()

    const remarcarButton = await screen.findByRole('button', { name: 'Remarcar' })
    expect(remarcarButton).not.toBeDisabled()
  })

  it('switches to "Histórico" and shows the known-gap placeholder instead of invented attendance data', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const gridSpy = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    // Espera a cadeia getMe -> getBookingsGrid assentar ANTES de seguir —
    // sem isso, o teste termina (e o cleanup do RTL desmonta + restaura os
    // mocks) enquanto o 2º efeito (gated por identityResolved) ainda está
    // em voo, e a chamada real a getBookingsGrid acontece já sem o mock,
    // gerando um fetch de verdade (URL relativa) e um unhandled rejection
    // — achado ao adicionar o hop extra de GET /me nesta correção.
    await waitFor(() => expect(gridSpy).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('tab', { name: 'Histórico' }))

    expect(screen.getByText(/Histórico indisponível nesta versão/)).toBeInTheDocument()
  })

  // Correção de review, rodada 2 (BEAC-1926): antes desta correção, não
  // havia teste checando que getBookingsGrid era chamado com um student_id
  // real (não havia nenhum pra passar) — a página buscava TODAS as reservas
  // da unit, vazando aulas particulares de outros alunos. Este teste prova
  // que a página resolve o próprio id via GET /me e o repassa.
  it('resolves the caller profile id via GET /me and passes it as student_id to getBookingsGrid', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'aluno-marina-id', fullName: 'Usuária de Teste' })
    const gridSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      bookings: [],
      viewOnly: false,
    })

    renderPage()

    await waitFor(() => expect(gridSpy).toHaveBeenCalled())

    expect(gridSpy).toHaveBeenCalledWith(
      'unit-1',
      expect.any(String),
      expect.any(String),
      undefined,
      'aluno-marina-id',
    )
  })

  // Se GET /me falhar (ex.: 403 de sessão temporary, ou qualquer erro), a
  // página não deve travar — cai de volta pro comportamento anterior
  // (busca sem student_id) em vez de nunca carregar nada.
  it('falls back to fetching without a student_id filter when GET /me fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: false, status: 403, error: 'forbidden' })
    const gridSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      bookings: [],
      viewOnly: false,
    })

    renderPage()

    await waitFor(() => expect(gridSpy).toHaveBeenCalled())

    expect(gridSpy).toHaveBeenCalledWith('unit-1', expect.any(String), expect.any(String), undefined, undefined)
  })

  // Grupo BEAC-1724/BEAC-2023: ?offer=<entryId> é como o tap numa
  // notificação vaga_waitlist chega nesta página (resolveNotificationRoute,
  // notificationRouting.ts) — sem navegação manual do aluno.
  describe('opening the offer sheet (AG9) from ?offer=<entryId>', () => {
    let gridSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      gridSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })
    })

    it('fetches the offer via GET /waitlist/{id} and opens OfferSheet with the fetched data', async () => {
      vi.spyOn(waitlistApi, 'getOfferDetail').mockResolvedValue(OFFER_DETAIL_FIXTURE)

      renderPageWithOffer('entry-1')

      expect(await screen.findByText('Abriu uma vaga pra você!')).toBeInTheDocument()
      expect(screen.getByText('Duda Rocha')).toBeInTheDocument()
      // Sem nextOccurrenceAt na fixture: cai pra "turma · quadra" sem data/hora
      // (ver formatOfferClassSchedule, mesmo "avisa, não bloqueia" do backend).
      expect(screen.getByText('Turma Beach Tennis · Quadra 2')).toBeInTheDocument()
      // Espera os efeitos de fundo (bookings/créditos, alheios à oferta)
      // assentarem antes do teste terminar — evita vazar uma fetch real
      // pendente pro afterEach do próximo teste (afterEach de arquivo roda
      // ANTES do cleanup() global de src/test/setup.ts, então mocks já
      // voltam a real antes do componente desmontar).
      await waitFor(() => expect(gridSpy).toHaveBeenCalled())
    })

    it('does not open the offer sheet when there is no ?offer= param (regression)', async () => {
      const detailSpy = vi.spyOn(waitlistApi, 'getOfferDetail')

      renderPage()

      await waitFor(() => expect(screen.getByText('Minha agenda')).toBeInTheDocument())
      expect(detailSpy).not.toHaveBeenCalled()
      expect(screen.queryByText('Abriu uma vaga pra você!')).not.toBeInTheDocument()
      await waitFor(() => expect(gridSpy).toHaveBeenCalled())
    })

    it('shows an error message instead of the sheet when the offer fetch fails (already resolved/expired)', async () => {
      vi.spyOn(waitlistApi, 'getOfferDetail').mockResolvedValue({ ok: false, status: 404, error: 'offer_not_found' })

      renderPageWithOffer('entry-1')

      expect(
        await screen.findByText('Não foi possível carregar esta oferta — ela pode já ter sido resolvida ou expirado.'),
      ).toBeInTheDocument()
      expect(screen.queryByText('Abriu uma vaga pra você!')).not.toBeInTheDocument()
      await waitFor(() => expect(gridSpy).toHaveBeenCalled())
    })

    it('closes the sheet without resolving the offer when "Fechar" (onCancel) is clicked', async () => {
      vi.spyOn(waitlistApi, 'getOfferDetail').mockResolvedValue(OFFER_DETAIL_FIXTURE)
      const user = userEvent.setup()

      renderPageWithOffer('entry-1')
      await screen.findByText('Abriu uma vaga pra você!')

      await user.click(screen.getByRole('button', { name: 'Fechar' }))

      expect(screen.queryByText('Abriu uma vaga pra você!')).not.toBeInTheDocument()
      await waitFor(() => expect(gridSpy).toHaveBeenCalled())
    })

    // Timers reais (mesmo padrão de OfferSheet.test.tsx "calls acceptOffer
    // when 'Confirmar vaga' is clicked"): OfferSheet resolve internamente
    // via setTimeout(1200ms) real antes de chamar onResolved — mais simples
    // e mais próximo do comportamento real do que orquestrar fake timers
    // junto com userEvent.
    it('shows a confirmation message, closes the sheet, and refreshes bookings after the offer is accepted', async () => {
      vi.spyOn(waitlistApi, 'getOfferDetail').mockResolvedValue(OFFER_DETAIL_FIXTURE)
      vi.spyOn(waitlistApi, 'acceptOffer').mockResolvedValue({
        ok: true,
        status: 'accepted',
        entryId: 'entry-1',
        classId: 'class-1',
        bookingId: 'booking-1',
      })
      const gridSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

      renderPageWithOffer('entry-1')
      await screen.findByText('Abriu uma vaga pra você!')
      const callsBeforeAccept = gridSpy.mock.calls.length

      await userEvent.click(screen.getByRole('button', { name: 'Confirmar vaga' }))

      expect(await screen.findByText('Vaga confirmada! A aula já apareceu na sua agenda.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Abriu uma vaga pra você!')).not.toBeInTheDocument(), { timeout: 2000 })
      await waitFor(() => expect(gridSpy.mock.calls.length).toBeGreaterThan(callsBeforeAccept))
    })
  })
})
