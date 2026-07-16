import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import S1Page from './S1Page'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/s1']}>
      <S1Page />
    </MemoryRouter>,
  )
}

describe('S1Page', () => {
  it('opens the "Entrar em nova arena" bottom sheet on trigger click', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /entrar em nova arena/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the sheet and shows an inline confirmation on successful redemption, without a full page reload', async () => {
    vi.spyOn(api, 'redeemInvite').mockResolvedValue({ unitId: 'unit-1', roleId: 'role-1' })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /entrar em nova arena/i }))
    await user.type(screen.getByLabelText(/código do convite/i), 'ABC123')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    expect(await screen.findByText('Você entrou na arena!')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the sheet via the backdrop without redeeming anything', async () => {
    const redeemSpy = vi.spyOn(api, 'redeemInvite')
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /entrar em nova arena/i }))
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    await user.click(backdrop)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(redeemSpy).not.toHaveBeenCalled()
  })
})
