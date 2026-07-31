import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatusMessage } from './StatusMessage'

const TONES = ['success', 'warning', 'danger', 'info'] as const

describe('StatusMessage', () => {
  describe('banner style', () => {
    it.each(TONES)('renders title, description and the tone icon for tone=%s', (tone) => {
      render(<StatusMessage style="banner" tone={tone} title="Alterações salvas!" description="Descrição opcional." />)
      expect(screen.getByText('Alterações salvas!')).toBeInTheDocument()
      expect(screen.getByText('Descrição opcional.')).toBeInTheDocument()
      const status = screen.getByRole('status')
      expect(status.className).toContain('status-message--banner')
      expect(status.className).toContain(`status-message--${tone}`)
      expect(status.querySelector('svg')).toBeInTheDocument()
    })

    it('hides the description when showDescription is false', () => {
      render(<StatusMessage style="banner" title="Título" description="Some texto" showDescription={false} />)
      expect(screen.queryByText('Some texto')).not.toBeInTheDocument()
    })

    it('omits the description paragraph when no description is given', () => {
      render(<StatusMessage style="banner" title="Título" />)
      expect(screen.getByText('Título')).toBeInTheDocument()
    })

    it('defaults to style=banner and tone=success', () => {
      render(<StatusMessage title="Título" />)
      const status = screen.getByRole('status')
      expect(status.className).toContain('status-message--banner')
      expect(status.className).toContain('status-message--success')
    })
  })

  describe('fullscreen style', () => {
    it.each(TONES)('renders the medallion icon, title and description for tone=%s', (tone) => {
      render(
        <StatusMessage
          style="fullscreen"
          tone={tone}
          title="Alterações salvas com sucesso!"
          description="Descrição opcional da mensagem."
        />,
      )
      expect(screen.getByText('Alterações salvas com sucesso!')).toBeInTheDocument()
      expect(screen.getByText('Descrição opcional da mensagem.')).toBeInTheDocument()
      const status = screen.getByRole('status')
      expect(status.className).toContain('status-message--fullscreen')
      expect(status.className).toContain(`status-message--${tone}`)
      expect(status.querySelector('.status-message__medallion svg')).toBeInTheDocument()
    })

    it('renders up to 2 actions and fires their onClick callbacks', () => {
      const onPrimary = vi.fn()
      const onSecondary = vi.fn()
      render(
        <StatusMessage
          style="fullscreen"
          tone="success"
          title="Título"
          actions={[
            { label: 'Ver financeiro', onClick: onPrimary },
            { label: 'Lançar outro', onClick: onSecondary, variant: 'secondary' },
          ]}
        />,
      )
      fireEvent.click(screen.getByText('Ver financeiro'))
      fireEvent.click(screen.getByText('Lançar outro'))
      expect(onPrimary).toHaveBeenCalledTimes(1)
      expect(onSecondary).toHaveBeenCalledTimes(1)
    })

    it('ignores actions beyond the first 2', () => {
      render(
        <StatusMessage
          style="fullscreen"
          tone="info"
          title="Título"
          actions={[{ label: 'Um' }, { label: 'Dois' }, { label: 'Três' }]}
        />,
      )
      expect(screen.getByText('Um')).toBeInTheDocument()
      expect(screen.getByText('Dois')).toBeInTheDocument()
      expect(screen.queryByText('Três')).not.toBeInTheDocument()
    })

    it('renders no actions block when actions is empty', () => {
      render(<StatusMessage style="fullscreen" tone="danger" title="Título" />)
      expect(screen.getByRole('status').querySelector('.status-message__actions')).not.toBeInTheDocument()
    })
  })
})
