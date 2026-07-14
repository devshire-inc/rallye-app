import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OAuthCallback } from './OAuthCallback'

describe('OAuthCallback', () => {
  it('forwards to /login, preserving the query string (oauth_error/provider) for the backend-initiated failure path', () => {
    const navigate = vi.fn()
    render(
      <OAuthCallback search="?oauth_error=exchange_failed&provider=google" navigate={navigate} />,
    )
    expect(navigate).toHaveBeenCalledWith('/login?oauth_error=exchange_failed&provider=google')
  })

  it('forwards to /login with no query string when nothing was passed', () => {
    const navigate = vi.fn()
    render(<OAuthCallback search="" navigate={navigate} />)
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('does not perform any token exchange (no fetch)', () => {
    const navigate = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<OAuthCallback search="?code=abc" navigate={navigate} />)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
