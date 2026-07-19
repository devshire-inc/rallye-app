import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as meApi from '../../lib/api/me'
import AG3StudentAgendaPage from './AG3StudentAgendaPage'

beforeEach(() => {
  // Default: GET /me resolves normally — mirrors a logged-in Aluno session.
  // Overridden per-test when a specific id or failure mode matters.
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'self-student-id' })
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
        },
      ],
    })

    renderPage()

    expect(screen.getByRole('tab', { name: 'Próximas' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('does NOT show the old fixed "Remarcações usadas este mês: 1/2" text, and marks the credits footer as TODO(BEAC-1706)', async () => {
    const gridSpy = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByText(/TODO\(BEAC-1706\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Remarcações usadas este mês/)).not.toBeInTheDocument()
    // Ver comentário no teste "switches to Histórico" — espera a cadeia
    // getMe -> getBookingsGrid assentar antes do teste terminar/desmontar.
    await waitFor(() => expect(gridSpy).toHaveBeenCalled())
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
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'aluno-marina-id' })
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
})
