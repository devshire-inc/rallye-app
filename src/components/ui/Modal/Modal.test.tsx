import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button/Button'
import { Modal } from './Modal'

function TriggerAndModal() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders its title and children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Confirmar cancelamento' })).toBeInTheDocument()
  })

  it('has role=dialog, aria-modal=true and aria-labelledby wired to the title', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Confirmar cancelamento' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not listen for Escape when closed', () => {
    const onClose = vi.fn()
    render(
      <Modal open={false} onClose={onClose} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when the scrim is clicked (default closeOnScrimClick)', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )

    // Clicking the dialog card itself stops propagation, so it must not close.
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on scrim click when closeOnScrimClick is false', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Confirmar cancelamento" closeOnScrimClick={false}>
        <p>conteúdo</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders the footer when provided', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Confirmar cancelamento"
        footer={
          <>
            <Button variant="secondary">Voltar</Button>
            <Button variant="primary">Confirmar cancelamento</Button>
          </>
        }
      >
        <p>conteúdo</p>
      </Modal>,
    )
    const buttons = screen.getAllByRole('button')
    // Voltar (secondary/menor risco) vem antes de Confirmar (primary) — à esquerda no footer.
    expect(buttons[buttons.length - 2]).toHaveTextContent('Voltar')
    expect(buttons[buttons.length - 1]).toHaveTextContent('Confirmar cancelamento')
  })

  it('renders no footer section when footer is omitted', () => {
    const { container } = render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    expect(container.querySelector('.modal-footer')).not.toBeInTheDocument()
  })

  it.each([
    ['sm', 'modal-card--sm'],
    ['md', 'modal-card--md'],
    ['lg', 'modal-card--lg'],
  ] as const)('applies the %s size class', (size, className) => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento" size={size}>
        <p>conteúdo</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveClass(className)
  })

  it('defaults to the md size', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveClass('modal-card--md')
  })

  it('moves focus into the dialog on open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar cancelamento">
        <p>conteúdo</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('traps Tab within the dialog, cycling from the last focusable element back to the first', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Confirmar cancelamento"
        footer={
          <>
            <Button variant="secondary">Voltar</Button>
            <Button variant="primary">Confirmar</Button>
          </>
        }
      >
        <p>conteúdo</p>
      </Modal>,
    )

    const closeButton = screen.getByRole('button', { name: 'Fechar' })
    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })

    confirmButton.focus()
    expect(confirmButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })

  it('traps Shift+Tab within the dialog, cycling from the first focusable element back to the last', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Confirmar cancelamento"
        footer={
          <>
            <Button variant="secondary">Voltar</Button>
            <Button variant="primary">Confirmar</Button>
          </>
        }
      >
        <p>conteúdo</p>
      </Modal>,
    )

    const closeButton = screen.getByRole('button', { name: 'Fechar' })
    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })

    closeButton.focus()
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirmButton).toHaveFocus()
  })

  it('returns focus to the trigger element when closed', () => {
    render(<TriggerAndModal />)

    const trigger = screen.getByRole('button', { name: 'Abrir' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger).toHaveFocus()
  })
})
