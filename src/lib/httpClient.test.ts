import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isNativePlatformMock,
  getSessionTokenMock,
  getRefreshTokenMock,
  setSessionTokenMock,
  setRefreshTokenMock,
} = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  getSessionTokenMock: vi.fn(),
  getRefreshTokenMock: vi.fn(),
  setSessionTokenMock: vi.fn(),
  setRefreshTokenMock: vi.fn(),
}))

vi.mock('./secureStorage', () => ({
  isNativePlatform: isNativePlatformMock,
  getSessionToken: getSessionTokenMock,
  getRefreshToken: getRefreshTokenMock,
  setSessionToken: setSessionTokenMock,
  setRefreshToken: setRefreshTokenMock,
}))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('httpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isNativePlatformMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('login: sends credentials include and returns ok + memberships on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { session_token: 'st', refresh_token: 'rt', memberships: ['a', 'b'] }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { login } = await import('./httpClient')
    const result = await login('user@example.com', 'secret')

    expect(result).toEqual({ ok: true, memberships: ['a', 'b'] })
    const [, options] = fetchMock.mock.calls[0]
    expect(options.credentials).toBe('include')
    expect(JSON.parse(options.body)).toEqual({ email: 'user@example.com', password: 'secret' })
  })

  it('login: returns generic failure on 401 without retrying refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'credenciais inválidas' }))
    vi.stubGlobal('fetch', fetchMock)

    const { login } = await import('./httpClient')
    const result = await login('user@example.com', 'wrong')

    expect(result).toEqual({ ok: false, memberships: [] })
    // não deveria ter chamado /auth/refresh para uma falha de login
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('login on native: persists tokens via secure storage', async () => {
    isNativePlatformMock.mockReturnValue(true)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { session_token: 'st', refresh_token: 'rt', memberships: [] }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { login } = await import('./httpClient')
    await login('user@example.com', 'secret')

    expect(setSessionTokenMock).toHaveBeenCalledWith('st')
    expect(setRefreshTokenMock).toHaveBeenCalledWith('rt')
  })

  it('apiFetch: 401 on a protected endpoint triggers one refresh and retries the original call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' })) // chamada original
      .mockResolvedValueOnce(
        jsonResponse(200, { session_token: 'new-st', refresh_token: 'new-rt', memberships: [] }),
      ) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' })) // retry da chamada original
    vi.stubGlobal('fetch', fetchMock)

    const { apiFetch } = await import('./httpClient')
    const response = await apiFetch('/some/protected/route')

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
  })

  it('apiFetch: 401 with failed refresh dispatches session-expired and returns the 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' })) // chamada original
      .mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' })) // refresh também falha
    vi.stubGlobal('fetch', fetchMock)

    const listener = vi.fn()
    window.addEventListener('rallye:session-expired', listener)

    const { apiFetch } = await import('./httpClient')
    const response = await apiFetch('/some/protected/route')

    expect(response.status).toBe(401)
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener('rallye:session-expired', listener)
  })

  it('apiFetch: does not intercept 401 coming from /auth/login itself', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'credenciais inválidas' }))
    vi.stubGlobal('fetch', fetchMock)

    const { apiFetch } = await import('./httpClient')
    await apiFetch('/auth/login', { method: 'POST', body: '{}' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('checkExistingSession: returns memberships when a valid session/refresh token already exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        session_token: 'st',
        refresh_token: 'rt',
        memberships: ['tenant-a', 'tenant-b'],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { checkExistingSession } = await import('./httpClient')
    const result = await checkExistingSession()

    expect(result).toEqual({ ok: true, memberships: ['tenant-a', 'tenant-b'] })
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/refresh')
  })

  it('checkExistingSession: returns null when there is no valid session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    const { checkExistingSession } = await import('./httpClient')
    const result = await checkExistingSession()

    expect(result).toBeNull()
  })

  it('logout: calls POST /auth/logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const { logout } = await import('./httpClient')
    await logout()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/auth/logout')
    expect(options.method).toBe('POST')
  })
})
