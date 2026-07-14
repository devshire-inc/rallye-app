import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function setPath(path: string) {
  window.history.pushState({}, '', path)
}

describe('App', () => {
  beforeEach(() => {
    setPath('/')
  })

  afterEach(() => {
    setPath('/')
  })

  it('renders the login page by default (A1)', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('renders the signup page at /signup (A2)', () => {
    setPath('/signup')
    render(<App />)
    expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
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
