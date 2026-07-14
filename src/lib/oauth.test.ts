import { describe, expect, it, vi } from 'vitest'
import { buildAuthorizeUrl, startOAuthLogin } from './oauth'

describe('buildAuthorizeUrl', () => {
  it('points at this backend own /auth/oauth/authorize endpoint, never at Supabase', () => {
    const url = buildAuthorizeUrl('http://localhost:8080', 'google')
    expect(url).toBe('http://localhost:8080/auth/oauth/authorize?provider=google')
  })

  it('works for apple too, and strips a trailing slash from the base URL', () => {
    const url = buildAuthorizeUrl('https://api.rallye.app/', 'apple')
    expect(url).toBe('https://api.rallye.app/auth/oauth/authorize?provider=apple')
  })
})

describe('startOAuthLogin', () => {
  it('performs a single full-page navigation to the backend authorize URL', () => {
    const navigate = vi.fn()
    startOAuthLogin('google', 'http://localhost:8080', navigate)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(
      'http://localhost:8080/auth/oauth/authorize?provider=google',
    )
  })
})
