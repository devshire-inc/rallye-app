import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkCard } from './LinkCard'

describe('LinkCard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the link text', () => {
    render(<LinkCard link="pay.rallye.com.br/c/8f2k91a" />)
    expect(screen.getByText('pay.rallye.com.br/c/8f2k91a')).toBeInTheDocument()
  })

  it('copies the link to the clipboard and shows the copied label', async () => {
    const user = userEvent.setup()
    render(<LinkCard link="pay.rallye.com.br/c/8f2k91a" />)

    await user.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(writeText).toHaveBeenCalledWith('pay.rallye.com.br/c/8f2k91a')
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()
  })

  it('reverts to the copy label after the timeout elapses', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<LinkCard link="pay.rallye.com.br/c/8f2k91a" copiedTimeout={2000} />)

    await user.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument())
  })

  it('calls onCopy with the link after a successful copy', async () => {
    const onCopy = vi.fn()
    const user = userEvent.setup()
    render(<LinkCard link="pay.rallye.com.br/c/8f2k91a" onCopy={onCopy} />)

    await user.click(screen.getByRole('button', { name: 'Copiar' }))

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('pay.rallye.com.br/c/8f2k91a'))
  })

  it('does not throw when the clipboard API rejects', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const user = userEvent.setup()
    render(<LinkCard link="pay.rallye.com.br/c/8f2k91a" />)

    await user.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  })
})
