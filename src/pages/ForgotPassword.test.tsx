import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ForgotPassword } from './ForgotPassword'
import * as passwordReset from '../lib/passwordReset'

describe('ForgotPassword (A3 etapa 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a generic success message for any email (anti-enumeration collapse)', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockResolvedValue({
      message:
        'Se este e-mail existir em nossa base, você receberá um e-mail com um código para redefinir sua senha.',
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/e-mail/i), 'qualquer@example.com')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/se este e-mail existir/i)
    })
    // Crucially: no "not found" / "create account" copy anywhere.
    expect(screen.queryByText(/nenhuma conta/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/criar conta/i)).not.toBeInTheDocument()
  })

  it('shows the rate-limit message distinctly when the backend returns rate_limited', async () => {
    vi.spyOn(passwordReset, 'requestPasswordReset').mockRejectedValue(
      new passwordReset.PasswordResetApiError(429, {
        error: 'rate_limited',
        message: 'Muitas tentativas. Aguarde 5 minutos e tente novamente.',
      }),
    )
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/aguarde 5 minutos/i)
    })
  })

  it('requires an email before submitting', async () => {
    const spy = vi.spyOn(passwordReset, 'requestPasswordReset')
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/informe um e-mail/i)
    expect(spy).not.toHaveBeenCalled()
  })
})
