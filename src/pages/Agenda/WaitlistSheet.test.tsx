import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as waitlistApi from '../../lib/api/waitlist'
import { WaitlistSheet } from './WaitlistSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderSheet(overrides: Partial<Parameters<typeof WaitlistSheet>[0]> = {}) {
  const onJoined = vi.fn()
  const onCancel = vi.fn()
  render(
    <WaitlistSheet
      classId="class-1"
      studentId="student-1"
      classSchedule="Futevôlei avançado · sáb 12 jul, 09:00 · Quadra 6"
      onJoined={onJoined}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onJoined, onCancel }
}

describe('WaitlistSheet', () => {
  it('shows a loading state before the status resolves', () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockReturnValue(new Promise(() => {}))
    renderSheet()
    // O AlertCard "Carregando…" virou <PageLoading>, que anuncia o
    // carregamento pela região aria-live do SkeletonGroup.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando fila de espera')
  })

  it('shows occupancy, queue size and the estimated position before joining', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 2,
      yourPosition: null,
    })
    renderSheet()

    expect(await screen.findByText('⏱ Turma lotada · 8 de 8 vagas')).toBeInTheDocument()
    expect(screen.getByText('Pessoas na fila').nextElementSibling?.textContent).toBe('2')
    expect(screen.getByText('Sua posição seria').nextElementSibling?.textContent).toBe('#3')
    expect(screen.getByRole('button', { name: 'Entrar na fila' })).toBeInTheDocument()
  })

  it('joins the queue and reflects the new position, calling onJoined', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 2,
      yourPosition: null,
    })
    const joinSpy = vi.spyOn(waitlistApi, 'joinWaitlist').mockResolvedValue({ ok: true, id: 'entry-1', position: 3 })
    const { onJoined } = renderSheet()

    const joinButton = await screen.findByRole('button', { name: 'Entrar na fila' })
    await userEvent.click(joinButton)

    expect(joinSpy).toHaveBeenCalledWith('class-1')
    const posLabel = await screen.findByText('Sua posição')
    expect(posLabel.nextElementSibling?.textContent).toBe('#3')
    expect(screen.getByText('Pessoas na fila').nextElementSibling?.textContent).toBe('3')
    expect(screen.getByRole('button', { name: 'Sair da fila' })).toBeInTheDocument()
    expect(onJoined).toHaveBeenCalledWith({ position: 3 })
  })

  it('shows the already-in-queue state with a ghost "Sair da fila" button', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 3,
      yourPosition: 2,
    })
    renderSheet()

    const posLabel = await screen.findByText('Sua posição')
    expect(posLabel.nextElementSibling?.textContent).toBe('#2')
    expect(screen.getByText('Pessoas na fila').nextElementSibling?.textContent).toBe('3')
    const leaveButton = screen.getByRole('button', { name: 'Sair da fila' })
    expect(leaveButton.className).toContain('button--secondary')
  })

  it('leaves the queue and reverts to the join state', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 3,
      yourPosition: 2,
    })
    const leaveSpy = vi.spyOn(waitlistApi, 'leaveWaitlist').mockResolvedValue({ ok: true })
    renderSheet()

    const leaveButton = await screen.findByRole('button', { name: 'Sair da fila' })
    await userEvent.click(leaveButton)

    expect(leaveSpy).toHaveBeenCalledWith('class-1', 'student-1')
    expect(await screen.findByRole('button', { name: 'Entrar na fila' })).toBeInTheDocument()
  })

  it('shows the "fila cheia" state and no functional join button when the queue is full', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 5,
      yourPosition: null,
    })
    renderSheet()

    expect(await screen.findByText('Waitlist cheia (5/5). Tente novamente mais tarde.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar na fila' })).not.toBeInTheDocument()
  })

  it('shows a mapped error message when joining fails, without calling onJoined', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 2,
      yourPosition: null,
    })
    vi.spyOn(waitlistApi, 'joinWaitlist').mockResolvedValue({ ok: false, status: 409, error: 'queue_full' })
    const { onJoined } = renderSheet()

    const joinButton = await screen.findByRole('button', { name: 'Entrar na fila' })
    await userEvent.click(joinButton)

    expect(await screen.findByText('Waitlist cheia (5/5). Tente novamente mais tarde.')).toBeInTheDocument()
    expect(onJoined).not.toHaveBeenCalled()
  })

  it('toggles "me avise" locally without calling any API', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 2,
      yourPosition: null,
    })
    const joinSpy = vi.spyOn(waitlistApi, 'joinWaitlist')
    renderSheet()

    const toggle = await screen.findByRole('button', { name: 'Me avise de qualquer vaga nesta turma' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(await screen.findByRole('button', { name: /Você será avisado de qualquer vaga/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(joinSpy).not.toHaveBeenCalled()
  })

  it('calls onCancel when "Fechar" is clicked', async () => {
    vi.spyOn(waitlistApi, 'getWaitlistStatus').mockResolvedValue({
      ok: true,
      activeEnrollments: 8,
      capacity: 8,
      queueSize: 2,
      yourPosition: null,
    })
    const { onCancel } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
