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
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
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

    expect(await screen.findByText('Lotada · 8/8')).toBeInTheDocument()
    expect(screen.getByText('2 pessoas · sua posição seria #3')).toBeInTheDocument()
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
    expect(await screen.findByText('3 pessoas · sua posição: #3')).toBeInTheDocument()
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

    expect(await screen.findByText('3 pessoas · sua posição: #2')).toBeInTheDocument()
    const leaveButton = screen.getByRole('button', { name: 'Sair da fila' })
    expect(leaveButton.className).toContain('btn-ghost')
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

    const toggle = await screen.findByRole('checkbox', { name: /Me avise de qualquer vaga/ })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
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
