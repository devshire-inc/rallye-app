import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function setPath(path: string) {
  window.history.pushState({}, '', path)
}

describe('App', () => {
  beforeEach(() => {
    setPath('/')
    checkExistingSessionMock.mockResolvedValue(null)
  })

  afterEach(() => {
    setPath('/')
  })

  it('redirects unknown routes to /login and shows the login form when there is no existing session', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
  })

  it('renders the signup page at /signup (A2)', async () => {
    setPath('/signup')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('forwards /oauth/callback straight to /login (kept only for backward-compat)', () => {
    // jsdom não permite redefinir window.location.assign com vi.spyOn
    // diretamente (não é configurável) — substitui-se location inteira só
    // para este teste, restaurando-a em seguida.
    const originalLocation = window.location
    const assignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/oauth/callback',
        search: '?oauth_error=exchange_failed&provider=google',
        assign: assignSpy,
      },
    })

    try {
      render(<App />)
      expect(assignSpy).toHaveBeenCalledWith('/login?oauth_error=exchange_failed&provider=google')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    }
  })
})
