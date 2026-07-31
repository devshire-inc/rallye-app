import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as waitlistApi from '../../lib/api/waitlist'
import { OfferSheet } from './OfferSheet'

const NOW = new Date('2026-07-12T09:00:00.000Z')

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderSheet(overrides: Partial<Parameters<typeof OfferSheet>[0]> = {}) {
  const onResolved = vi.fn()
  const onCancel = vi.fn()
  render(
    <OfferSheet
      entryId="entry-1"
      // Relativo ao Date.now() REAL no momento do render, não à constante
      // NOW (fixa em 2026-07-12) — testes que NÃO fazem vi.setSystemTime
      // rodam sob o relógio real do ambiente, então um expiresAt ancorado
      // em NOW ficaria no passado e disparia o auto-aceite da vaga
      // imediatamente (achado ao escrever este teste).
      expiresAt={new Date(Date.now() + 2 * 60 * 60 * 1000 - 13_000).toISOString()}
      classSchedule="Futevôlei avançado · sáb 12 jul, 09:00 · Quadra 6"
      teacherName="Duda Rocha"
      activeEnrollments={7}
      capacity={8}
      onResolved={onResolved}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onResolved, onCancel }
}

describe('OfferSheet', () => {
  it('renders the exact prototype copy: title, subtitle, professor/turma rows and footnote', () => {
    renderSheet()

    expect(screen.getByText('Vaga disponível!')).toBeInTheDocument()
    expect(screen.getByText('Futevôlei avançado · sáb 12 jul, 09:00 · Quadra 6')).toBeInTheDocument()
    expect(screen.getByText('Duda Rocha')).toBeInTheDocument()
    expect(screen.getByText('7/8 (a vaga é sua)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Recusar ou deixar o tempo esgotar passa a vaga pro próximo da fila automaticamente — sem penalidade.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the countdown in HH:MM:SS format and ticks down every second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    renderSheet()
    expect(screen.getByText('01:59:47')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('01:59:46')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByText('01:59:36')).toBeInTheDocument()
  })

  it('calls acceptOffer when "Confirmar vaga" is clicked and shows the success message', async () => {
    const acceptSpy = vi
      .spyOn(waitlistApi, 'acceptOffer')
      .mockResolvedValue({ ok: true, status: 'accepted', entryId: 'entry-1', classId: 'class-1', bookingId: 'booking-1' })
    const { onResolved } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar vaga' }))

    expect(acceptSpy).toHaveBeenCalledWith('entry-1')
    expect(await screen.findByText('Vaga confirmada! A aula já apareceu na sua agenda.')).toBeInTheDocument()
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith({ status: 'accepted' }), { timeout: 2000 })
  })

  it('calls declineOffer when "Recusar" is clicked and shows the neutral message', async () => {
    const declineSpy = vi
      .spyOn(waitlistApi, 'declineOffer')
      .mockResolvedValue({ ok: true, status: 'declined', entryId: 'entry-1' })
    const { onResolved } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Recusar e sair da fila' }))

    expect(declineSpy).toHaveBeenCalledWith('entry-1')
    expect(await screen.findByText('Sem problema — a vaga passou pro próximo da fila.')).toBeInTheDocument()
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith({ status: 'declined' }), { timeout: 2000 })
  })

  it('calls acceptOffer automatically when the local timer reaches zero, not decline', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const acceptSpy = vi
      .spyOn(waitlistApi, 'acceptOffer')
      .mockResolvedValue({ ok: true, status: 'expired', entryId: 'entry-1', classId: 'class-1' })
    const declineSpy = vi.spyOn(waitlistApi, 'declineOffer')
    // Prazo curto (5s) — não os ~2h do caminho feliz — pra chegar a zero
    // rapidamente dentro do teste.
    renderSheet({ expiresAt: new Date(NOW.getTime() + 5000).toISOString() })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(acceptSpy).toHaveBeenCalledWith('entry-1')
    expect(declineSpy).not.toHaveBeenCalled()
    expect(
      screen.getByText('O prazo pra confirmar esta vaga expirou — ela já passou pro próximo da fila.'),
    ).toBeInTheDocument()
  })

  it('distinguishes an expired-on-accept response from a generic failure', async () => {
    vi.spyOn(waitlistApi, 'acceptOffer').mockResolvedValue({
      ok: true,
      status: 'expired',
      entryId: 'entry-1',
      classId: 'class-1',
    })
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar vaga' }))

    const message = await screen.findByText(
      'O prazo pra confirmar esta vaga expirou — ela já passou pro próximo da fila.',
    )
    expect(message.closest('[role]')?.getAttribute('role')).toBe('status')
  })

  it('stops ticking and hides action buttons once resolved', async () => {
    vi.spyOn(waitlistApi, 'declineOffer').mockResolvedValue({ ok: true, status: 'declined', entryId: 'entry-1' })
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Recusar e sair da fila' }))
    await screen.findByText('Sem problema — a vaga passou pro próximo da fila.')

    expect(screen.queryByRole('button', { name: 'Confirmar vaga' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recusar e sair da fila' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument()
  })

  it('calls onCancel when "Fechar" is clicked', async () => {
    const { onCancel } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
