import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaitlistCard } from './WaitlistCard'

describe('WaitlistCard', () => {
  describe('aguardando', () => {
    it('renders the queue position and waiting copy', () => {
      render(<WaitlistCard state="aguardando" position={3} title="Aula de Padel" />)
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Aula de Padel')).toBeInTheDocument()
      expect(screen.getByText('Avisaremos quando abrir uma vaga')).toBeInTheDocument()
    })

    it('renders no CTA', () => {
      render(<WaitlistCard state="aguardando" position={3} title="Aula de Padel" />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('vaga-disponivel', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders the countdown as a full phrase, not a raw MM:SS string', () => {
      const expiresAt = new Date(Date.now() + 8 * 60_000).toISOString()
      render(<WaitlistCard state="vaga-disponivel" position={1} title="Aula de Padel" expiresAt={expiresAt} />)
      expect(screen.getByText('Restam 8 minutos')).toBeInTheDocument()
      expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument()
    })

    it('uses singular "minuto" when exactly 1 minute remains', () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString()
      render(<WaitlistCard state="vaga-disponivel" position={1} title="Aula de Padel" expiresAt={expiresAt} />)
      expect(screen.getByText('Restam 1 minuto')).toBeInTheDocument()
    })

    it('marks the countdown region as aria-live="polite"', () => {
      const expiresAt = new Date(Date.now() + 8 * 60_000).toISOString()
      render(<WaitlistCard state="vaga-disponivel" position={1} title="Aula de Padel" expiresAt={expiresAt} />)
      expect(screen.getByText('Restam 8 minutos')).toHaveAttribute('aria-live', 'polite')
    })

    it('ticks the countdown once per minute, not per second', () => {
      const expiresAt = new Date(Date.now() + 3 * 60_000).toISOString()
      render(<WaitlistCard state="vaga-disponivel" position={1} title="Aula de Padel" expiresAt={expiresAt} />)
      expect(screen.getByText('Restam 3 minutos')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      expect(screen.getByText('Restam 3 minutos')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      expect(screen.getByText('Restam 2 minutos')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(screen.getByText('Restam 1 minuto')).toBeInTheDocument()
    })

    it('renders a real Button CTA labelled "Reservar" that calls onReserve', async () => {
      vi.useRealTimers()
      const onReserve = vi.fn()
      const user = userEvent.setup()
      const expiresAt = new Date(Date.now() + 8 * 60_000).toISOString()
      render(
        <WaitlistCard
          state="vaga-disponivel"
          position={1}
          title="Aula de Padel"
          expiresAt={expiresAt}
          onReserve={onReserve}
        />,
      )
      const button = screen.getByRole('button', { name: 'Reservar' })
      await user.click(button)
      expect(onReserve).toHaveBeenCalledTimes(1)
    })
  })

  describe('expirado', () => {
    it('renders an em dash instead of a position number', () => {
      render(<WaitlistCard state="expirado" title="Aula de Padel" />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('communicates the missed-window state in writing', () => {
      render(<WaitlistCard state="expirado" title="Aula de Padel" />)
      expect(screen.getByText('Você perdeu a vez nesta rodada.')).toBeInTheDocument()
    })

    it('renders no CTA at all — not just visually hidden', () => {
      render(<WaitlistCard state="expirado" title="Aula de Padel" onReserve={vi.fn()} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByText('Reservar')).not.toBeInTheDocument()
    })
  })
})
