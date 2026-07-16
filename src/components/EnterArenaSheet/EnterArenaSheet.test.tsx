import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { EnterArenaSheet } from './EnterArenaSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderSheet(onSuccess = vi.fn()) {
  render(<EnterArenaSheet onSuccess={onSuccess} />)
  return { onSuccess }
}

async function submitCode(code: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/código do convite/i), code)
  await user.click(screen.getByRole('button', { name: /entrar/i }))
}

describe('EnterArenaSheet', () => {
  it('disables submit while the code field is empty', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled()
  })

  it('calls onSuccess with the redeemed unit/role on a 200 response', async () => {
    vi.spyOn(api, 'redeemInvite').mockResolvedValue({ unitId: 'unit-1', roleId: 'role-1' })
    const { onSuccess } = renderSheet()

    await submitCode('ABC123')

    expect(api.redeemInvite).toHaveBeenCalledWith('ABC123')
    expect(onSuccess).toHaveBeenCalledWith({ unitId: 'unit-1', roleId: 'role-1' })
  })

  it('shows the exact "not found" message as an alert on invite_not_found (410)', async () => {
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('invite_not_found'))
    renderSheet()

    await submitCode('DOESNOTEXIST')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Código não encontrado')
    expect(alert).toHaveClass('enter-arena-sheet__feedback--error')
  })

  it('shows the exact "expired" message as an alert on invite_expired (410)', async () => {
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('invite_expired'))
    renderSheet()

    await submitCode('EXPIRED1')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Código expirado. Peça um novo.')
    expect(alert).toHaveClass('enter-arena-sheet__feedback--error')
  })

  it('shows the "already member" case (409) as informational, not an error', async () => {
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('already_member'))
    renderSheet()

    await submitCode('ALREADYIN')

    const info = await screen.findByRole('status')
    expect(info).toHaveTextContent('Você já faz parte desta arena!')
    expect(info).toHaveClass('enter-arena-sheet__feedback--info')
    expect(info).not.toHaveClass('enter-arena-sheet__feedback--error')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the feedback state when the user edits the code again', async () => {
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('invite_not_found'))
    renderSheet()

    await submitCode('DOESNOTEXIST')
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/código do convite/i), 'X')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveRedeem: (value: { unitId: string; roleId: string }) => void = () => {}
    vi.spyOn(api, 'redeemInvite').mockReturnValue(
      new Promise((resolve) => {
        resolveRedeem = resolve
      }),
    )
    renderSheet()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/código do convite/i), 'ABC123')
    const button = screen.getByRole('button', { name: /entrar/i })
    await user.click(button)

    expect(button).toBeDisabled()
    resolveRedeem({ unitId: 'unit-1', roleId: 'role-1' })
  })
})
