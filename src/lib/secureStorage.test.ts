import { afterEach, describe, expect, it, vi } from 'vitest'

const { isNativePlatformMock, getItemMock, setItemMock, removeItemMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(),
  getItemMock: vi.fn(),
  setItemMock: vi.fn(),
  removeItemMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}))

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    getItem: getItemMock,
    setItem: setItemMock,
    removeItem: removeItemMock,
  },
}))

describe('secureStorage (web)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('is a no-op on web: never reads from native storage', async () => {
    isNativePlatformMock.mockReturnValue(false)
    const { getSessionToken } = await import('./secureStorage')

    const token = await getSessionToken()

    expect(token).toBeNull()
    expect(getItemMock).not.toHaveBeenCalled()
  })

  it('is a no-op on web: never writes to native storage', async () => {
    isNativePlatformMock.mockReturnValue(false)
    const { setSessionToken } = await import('./secureStorage')

    await setSessionToken('token-value')

    expect(setItemMock).not.toHaveBeenCalled()
  })

  it('is a no-op on web: clearTokens does not touch native storage', async () => {
    isNativePlatformMock.mockReturnValue(false)
    const { clearTokens } = await import('./secureStorage')

    await clearTokens()

    expect(removeItemMock).not.toHaveBeenCalled()
  })
})

describe('secureStorage (native)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('persists the session token under its own key on native platforms', async () => {
    isNativePlatformMock.mockReturnValue(true)
    const { setSessionToken, SESSION_TOKEN_KEY } = await import('./secureStorage')

    await setSessionToken('abc123')

    expect(setItemMock).toHaveBeenCalledWith(SESSION_TOKEN_KEY, 'abc123')
  })

  it('persists the refresh token under its own key on native platforms', async () => {
    isNativePlatformMock.mockReturnValue(true)
    const { setRefreshToken, REFRESH_TOKEN_KEY } = await import('./secureStorage')

    await setRefreshToken('refresh-abc')

    expect(setItemMock).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'refresh-abc')
  })

  it('reads the session token back from native storage', async () => {
    isNativePlatformMock.mockReturnValue(true)
    getItemMock.mockResolvedValue('stored-token')
    const { getSessionToken, SESSION_TOKEN_KEY } = await import('./secureStorage')

    const token = await getSessionToken()

    expect(token).toBe('stored-token')
    expect(getItemMock).toHaveBeenCalledWith(SESSION_TOKEN_KEY)
  })

  it('clearTokens removes both keys from native storage', async () => {
    isNativePlatformMock.mockReturnValue(true)
    const { clearTokens, SESSION_TOKEN_KEY, REFRESH_TOKEN_KEY } = await import('./secureStorage')

    await clearTokens()

    expect(removeItemMock).toHaveBeenCalledWith(SESSION_TOKEN_KEY)
    expect(removeItemMock).toHaveBeenCalledWith(REFRESH_TOKEN_KEY)
  })
})
