import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

const { checkExistingSessionMock } = vi.hoisted(() => ({
  checkExistingSessionMock: vi.fn(),
}))

vi.mock('./lib/httpClient', async () => {
  const actual = await vi.importActual<typeof import('./lib/httpClient')>('./lib/httpClient')
  return {
    ...actual,
    checkExistingSession: checkExistingSessionMock,
  }
})

describe('App', () => {
  it('redirects unknown routes to /login and shows the login form when there is no existing session', async () => {
    checkExistingSessionMock.mockResolvedValue(null)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
  })
})
