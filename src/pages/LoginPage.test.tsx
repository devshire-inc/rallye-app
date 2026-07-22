import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const { checkExistingSessionMock, loginMock } = vi.hoisted(() => ({
  checkExistingSessionMock: vi.fn(),
  loginMock: vi.fn(),
}))

vi.mock('../lib/httpClient', () => ({
  checkExistingSession: checkExistingSessionMock,
  login: loginMock,
}))

function renderLoginPage(searchParams?: URLSearchParams) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage searchParams={searchParams} />} />
        <Route path="/dashboard" element={<div>Dashboard placeholder</div>} />
        <Route path="/units/:unitId/dashboard" element={<div>Dashboard placeholder</div>} />
        <Route path="/s1" element={<div>S1 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the login form when there is no existing valid session', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    renderLoginPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    })
  })

  it('renders the Google social login button', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    renderLoginPage(new URLSearchParams())

    await waitFor(() => {
      expect(screen.getByText(/continuar com google/i)).toBeInTheDocument()
    })
  })

  it('skips the login form and redirects straight to the dashboard when the session is already valid (1 membership)', async () => {
    checkExistingSessionMock.mockResolvedValue({ ok: true, memberships: ['tenant-a'] })

    renderLoginPage()

    await waitFor(() => {
      expect(screen.getByText('Dashboard placeholder')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /entrar/i })).not.toBeInTheDocument()
  })

  it('skips the login form and redirects straight to S1 when the session is already valid (2+ memberships)', async () => {
    checkExistingSessionMock.mockResolvedValue({ ok: true, memberships: ['tenant-a', 'tenant-b'] })

    renderLoginPage()

    await waitFor(() => {
      expect(screen.getByText('S1 placeholder')).toBeInTheDocument()
    })
  })

  it('shows a generic error message on invalid credentials (401), never revealing whether the e-mail exists', async () => {
    checkExistingSessionMock.mockResolvedValue(null)
    loginMock.mockResolvedValue({ ok: false, memberships: [] })
    const user = userEvent.setup()

    renderLoginPage()
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))

    await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('credenciais inválidas')
  })

  it('redirects to the dashboard on successful login with 1 membership', async () => {
    checkExistingSessionMock.mockResolvedValue(null)
    loginMock.mockResolvedValue({ ok: true, memberships: ['tenant-a'] })
    const user = userEvent.setup()

    renderLoginPage()
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))

    await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard placeholder')).toBeInTheDocument()
    })
    expect(loginMock).toHaveBeenCalledWith('user@example.com', 'correct-password')
  })

  it('redirects to S1 on successful login with 2+ memberships', async () => {
    checkExistingSessionMock.mockResolvedValue(null)
    loginMock.mockResolvedValue({ ok: true, memberships: ['tenant-a', 'tenant-b'] })
    const user = userEvent.setup()

    renderLoginPage()
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))

    await user.type(screen.getByLabelText(/e-mail/i), 'user@example.com')
    await user.type(screen.getByLabelText(/senha/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('S1 placeholder')).toBeInTheDocument()
    })
  })

  it('shows the exact Google toast text when redirected back with oauth_error (backend-initiated failure)', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    renderLoginPage(new URLSearchParams('oauth_error=exchange_failed&provider=google'))

    expect(
      await screen.findByText('Não foi possível conectar com Google. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('defaults to the Google toast text when provider is absent from oauth_error redirect', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    renderLoginPage(new URLSearchParams('oauth_error=state_invalid'))

    expect(
      await screen.findByText('Não foi possível conectar com Google. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('shows no oauth toast when there is no oauth_error param', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    renderLoginPage(new URLSearchParams())

    await waitFor(() => screen.getByRole('button', { name: /entrar/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
