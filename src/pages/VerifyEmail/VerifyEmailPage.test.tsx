import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { setPendingVerification, clearPendingVerification } from '../../lib/pendingVerification'
import { VerifyEmailPage } from './VerifyEmailPage'

function renderPage(initialPath = '/verify-email') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/dashboard" element={<div>Dashboard stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillOtp(code: string) {
  const inputs = screen.getAllByRole('textbox')
  code.split('').forEach((digit, i) => {
    fireEvent.change(inputs[i], { target: { value: digit } })
  })
}

beforeEach(() => {
  setPendingVerification({ userId: 'user-1', email: 'fulano@example.com' })
})

afterEach(() => {
  clearPendingVerification()
  vi.restoreAllMocks()
})

describe('VerifyEmailPage', () => {
  it('shows the registered email', () => {
    renderPage()
    expect(screen.getByText(/fulano@example.com/)).toBeInTheDocument()
  })

  it('verifies automatically via deep link code in the URL, without manual entry', async () => {
    const verifySpy = vi.spyOn(api, 'verifyEmail').mockResolvedValue(undefined)
    renderPage('/verify-email?user_id=user-1&code=123456')

    await waitFor(() => expect(verifySpy).toHaveBeenCalledWith('user-1', '123456'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email verificado!'))
  })

  it('on success shows a toast and redirects to the dashboard', async () => {
    vi.spyOn(api, 'verifyEmail').mockResolvedValue(undefined)
    renderPage()

    fillOtp('123456')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email verificado!'))
    await waitFor(() => expect(screen.getByText('Dashboard stub')).toBeInTheDocument(), {
      timeout: 2000,
    })
  })

  it('on invalid code shows an error message and clears the fields', async () => {
    vi.spyOn(api, 'verifyEmail').mockRejectedValue(new api.VerifyEmailError('invalid_code'))
    renderPage()

    fillOtp('000000')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código incorreto'))
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs.every((i) => i.value === '')).toBe(true)
  })

  it('on expired code shows the expired message with a resend option', async () => {
    vi.spyOn(api, 'verifyEmail').mockRejectedValue(new api.VerifyEmailError('code_expired'))
    renderPage()

    fillOtp('123456')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Código expirado/))
    expect(screen.getByRole('button', { name: /reenviar/i })).toBeInTheDocument()
  })

  it('on lock (too many attempts) shows a locked message', async () => {
    vi.spyOn(api, 'verifyEmail').mockRejectedValue(new api.VerifyEmailError('too_many_attempts'))
    renderPage()

    fillOtp('000000')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Muitas tentativas/))
  })
})
