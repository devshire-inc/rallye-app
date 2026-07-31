import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

const TONES = ['success', 'warning', 'danger', 'info'] as const

describe('Toast', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} onDismiss={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message inside role=status', () => {
    render(<Toast message="Reserva confirmada com sucesso!" onDismiss={() => {}} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Reserva confirmada com sucesso!')
  })

  describe('backward compat (variant)', () => {
    it('defaults to variant=error -> tone danger when neither prop is given', () => {
      render(<Toast message="Erro" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--danger')
    })

    it('maps variant="error" to tone danger', () => {
      render(<Toast message="Erro" variant="error" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--danger')
    })

    it('maps variant="success" to tone success', () => {
      render(<Toast message="Sucesso" variant="success" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--success')
    })

    it('lets tone override variant when both are given', () => {
      render(<Toast message="Aviso" variant="success" tone="warning" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--warning')
      expect(screen.getByRole('status').className).not.toContain('toast--success')
    })
  })

  describe('tone', () => {
    it.each(TONES)('renders tone=%s with its class and icon', (tone) => {
      render(<Toast message="Mensagem" tone={tone} onDismiss={() => {}} />)
      const status = screen.getByRole('status')
      expect(status.className).toContain(`toast--${tone}`)
      expect(status.querySelector('.toast__icon svg')).toBeInTheDocument()
    })

    it.each([
      ['success', 'polite'],
      ['info', 'polite'],
      ['warning', 'assertive'],
      ['danger', 'assertive'],
    ] as const)('sets aria-live=%s for tone=%s', (tone, live) => {
      render(<Toast message="Mensagem" tone={tone} onDismiss={() => {}} />)
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', live)
    })
  })

  describe('layout', () => {
    it('uses the auto (media-query driven) position class by default', () => {
      render(<Toast message="Mensagem" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--pos-auto')
    })

    it('forces the mobile position class when layout="mobile"', () => {
      render(<Toast message="Mensagem" layout="mobile" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--pos-mobile')
    })

    it('forces the desktop position class when layout="desktop"', () => {
      render(<Toast message="Mensagem" layout="desktop" onDismiss={() => {}} />)
      expect(screen.getByRole('status').className).toContain('toast--pos-desktop')
    })
  })

  describe('action', () => {
    it('renders no action button when action is omitted', () => {
      render(<Toast message="Mensagem" onDismiss={() => {}} />)
      expect(screen.getByRole('status').querySelector('.toast__action')).not.toBeInTheDocument()
    })

    it('renders the action label and fires its onClick', () => {
      const onAction = vi.fn()
      render(<Toast message="Mensagem" action={{ label: 'Desfazer', onClick: onAction }} onDismiss={() => {}} />)
      fireEvent.click(screen.getByText('Desfazer'))
      expect(onAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('close button', () => {
    it('renders a keyboard-reachable close button labeled "Fechar"', () => {
      render(<Toast message="Mensagem" onDismiss={() => {}} />)
      expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    })

    it('calls onDismiss when the close button is clicked', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Mensagem" onDismiss={onDismiss} />)
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })
})
