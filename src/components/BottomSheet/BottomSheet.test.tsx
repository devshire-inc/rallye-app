import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BottomSheet open={false} onClose={vi.fn()}>
        <p>conteúdo</p>
      </BottomSheet>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders its children when open', () => {
    render(
      <BottomSheet open onClose={vi.fn()}>
        <p>conteúdo</p>
      </BottomSheet>,
    )
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose}>
        <p>conteúdo</p>
      </BottomSheet>,
    )

    // The dialog itself stops propagation, so clicking it must not close.
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    // Clicking the backdrop (outside the panel) closes it.
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose}>
        <p>conteúdo</p>
      </BottomSheet>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not listen for Escape when closed', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open={false} onClose={onClose}>
        <p>conteúdo</p>
      </BottomSheet>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
