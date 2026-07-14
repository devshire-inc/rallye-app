import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ResetPassword } from './ResetPassword'
import * as passwordReset from '../lib/passwordReset'

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
  password: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText(/^código$/i), code)
  await user.type(screen.getByLabelText(/^nova senha$/i), password)
  await user.type(screen.getByLabelText(/^confirmar senha$/i), confirm)
}

describe('ResetPassword (A3 etapa 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('validates inline when passwords do not match, without calling the API', async () => {
    const spy = vi.spyOn(passwordReset, 'confirmPasswordReset')
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?email=user%40example.com']}>
        <ResetPassword />
      </MemoryRouter>,
    )

    await fillForm(user, '123456', 'correct-horse-battery', 'different-password')
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }))

    expect(await screen.findByText(/as senhas não coincidem/i)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a toast and redirects on a successful reset', async () => {
    vi.spyOn(passwordReset, 'confirmPasswordReset').mockResolvedValue({
      message: 'Senha redefinida com sucesso.',
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?email=user%40example.com']}>
        <ResetPassword />
      </MemoryRouter>,
    )

    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/senha redefinida!/i)
    })
  })

  it('shows "Código inválido ou expirado." for an invalid code without forcing a restart', async () => {
    vi.spyOn(passwordReset, 'confirmPasswordReset').mockRejectedValue(
      new passwordReset.PasswordResetApiError(400, {
        error: 'invalid_code',
        message: 'Código inválido ou expirado.',
      }),
    )
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?email=user%40example.com']}>
        <ResetPassword />
      </MemoryRouter>,
    )

    await fillForm(user, '000000', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }))

    expect(await screen.findByText(/código inválido ou expirado/i)).toBeInTheDocument()
    expect(screen.queryByText(/solicitar novo código/i)).not.toBeInTheDocument()
  })

  it('forces a restart of step 1 after too_many_attempts', async () => {
    vi.spyOn(passwordReset, 'confirmPasswordReset').mockRejectedValue(
      new passwordReset.PasswordResetApiError(429, {
        error: 'too_many_attempts',
        message: 'Muitas tentativas. Solicite um novo código.',
      }),
    )
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?email=user%40example.com']}>
        <ResetPassword />
      </MemoryRouter>,
    )

    await fillForm(user, '000000', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }))

    expect(await screen.findByText(/muitas tentativas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /solicitar novo código/i })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    )
  })

  it('forces a restart of step 1 for an expired code, with a distinct message', async () => {
    vi.spyOn(passwordReset, 'confirmPasswordReset').mockRejectedValue(
      new passwordReset.PasswordResetApiError(400, {
        error: 'code_expired',
        message: 'Link expirado. Solicite um novo código.',
      }),
    )
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/redefinir-senha?email=user%40example.com']}>
        <ResetPassword />
      </MemoryRouter>,
    )

    await fillForm(user, '123456', 'correct-horse-battery', 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }))

    expect(await screen.findByText(/link expirado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /solicitar novo código/i })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    )
  })
})
