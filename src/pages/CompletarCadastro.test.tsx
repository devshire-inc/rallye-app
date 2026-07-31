import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CompletarCadastro } from './CompletarCadastro'
import * as passwordReset from '../lib/passwordReset'
import * as httpClient from '../lib/httpClient'
import * as api from '../lib/api'
import type { MembershipListItem } from '../lib/api'

const navigateMock = vi.fn()

function membershipItem(unitId: string): MembershipListItem {
  return {
    unitId,
    unit: { name: 'Arena', address: null, sportsOffered: null },
    role: null,
    lastAccessedAt: null,
    liveActivity: null,
  }
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
  password: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText(/^código$/i), code)
  await user.type(screen.getByLabelText(/^senha$/i), password)
  await user.type(screen.getByLabelText(/^confirmar senha$/i), confirm)
}

describe('CompletarCadastro (BEAC-1860)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    navigateMock.mockReset()
  })

  it('shows a fallback error when the invite link is missing email/invite params', async () => {
    render(
      <MemoryRouter initialEntries={['/completar-cadastro']}>
        <CompletarCadastro />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/link de convite inválido/i)).toBeInTheDocument()
  })

  it('auto-requests a code on mount using the email from the invite link', async () => {
    const requestSpy = vi
      .spyOn(passwordReset, 'requestPasswordReset')
      .mockResolvedValue({ message: 'ok' })

    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith('aluno@example.com')
    })
    expect(await screen.findByText(/código enviado para: aluno@example.com/i)).toBeInTheDocument()
  })

  it('completes signup, redeems the invite, and redirects to the unit dashboard for exactly 1 membership', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    const completeSpy = vi.spyOn(httpClient, 'completeInviteSignup').mockResolvedValue(undefined)
    const redeemSpy = vi
      .spyOn(api, 'redeemInvite')
      .mockResolvedValue({ unitId: 'unit-1', roleId: 'role-aluno' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem('unit-1')])

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(
        'aluno@example.com',
        '123456',
        'correct-horse-battery',
      )
    })
    await waitFor(() => {
      expect(redeemSpy).toHaveBeenCalledWith('INVITE123')
    })
    await user.click(await screen.findByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/units/unit-1/dashboard', { replace: true })
    })
  })

  it('redirects to S1 when redeem leaves the user with 2+ memberships', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockResolvedValue(undefined)
    vi.spyOn(api, 'redeemInvite').mockResolvedValue({ unitId: 'unit-1', roleId: 'role-aluno' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([
      membershipItem('unit-1'),
      membershipItem('unit-2'),
    ])

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    await user.click(await screen.findByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/s1', { replace: true })
    })
  })

  it('shows an inline error for an invalid code without discarding the invite', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockRejectedValue(
      new httpClient.CompleteInviteError('invalid_code', 'Código inválido ou expirado.'),
    )
    const redeemSpy = vi.spyOn(api, 'redeemInvite')

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '000000', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    expect(await screen.findByText(/código inválido ou expirado/i)).toBeInTheDocument()
    expect(redeemSpy).not.toHaveBeenCalled()
  })

  it('offers a resend action after too_many_attempts', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockRejectedValue(
      new httpClient.CompleteInviteError(
        'too_many_attempts',
        'Muitas tentativas. Solicite um novo código.',
      ),
    )

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '000000', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    expect(await screen.findByText(/muitas tentativas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reenviar código/i })).toBeInTheDocument()
  })

  it('shows an expired-invite message from redeem after a successful password set', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockResolvedValue(undefined)
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('invite_expired'))

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    expect(await screen.findByText(/o convite expirou/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('treats already_member from redeem as success and redirects per the current membership count', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockResolvedValue(undefined)
    vi.spyOn(api, 'redeemInvite').mockRejectedValue(new api.RedeemInviteError('already_member'))
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([membershipItem('unit-1')])

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/units/unit-1/dashboard', { replace: true })
    })
  })

  it('redirects to S1 when zero memberships come back (empty-state lives there)', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({ message: 'ok' })
    vi.spyOn(httpClient, 'completeInviteSignup').mockResolvedValue(undefined)
    vi.spyOn(api, 'redeemInvite').mockResolvedValue({ unitId: 'unit-1', roleId: 'role-aluno' })
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue([])

    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/completar-cadastro?email=aluno%40example.com&invite=INVITE123']}
      >
        <CompletarCadastro />
      </MemoryRouter>,
    )

    await screen.findByText(/código enviado para/i)
    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /ativar minha conta/i }))

    await user.click(await screen.findByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/s1', { replace: true })
    })
  })
})
