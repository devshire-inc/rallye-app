import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom não expõe localStorage por padrão nesta config de vitest (nenhum
// outro teste do repo usa localStorage direto até esta task) — polyfill
// mínimo em memória, escopado a este arquivo de teste.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
})

const {
  isNativePlatformMock,
  getPlatformMock,
  checkPermissionsMock,
  requestPermissionsMock,
  registerMock,
  addListenerMock,
  isSupportedMock,
  initializeAppMock,
  getMessagingMock,
  getTokenMock,
  onMessageMock,
  apiFetchMock,
} = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(),
  getPlatformMock: vi.fn(),
  checkPermissionsMock: vi.fn(),
  requestPermissionsMock: vi.fn(),
  registerMock: vi.fn(),
  addListenerMock: vi.fn(),
  isSupportedMock: vi.fn(),
  initializeAppMock: vi.fn(),
  getMessagingMock: vi.fn(),
  getTokenMock: vi.fn(),
  onMessageMock: vi.fn(),
  apiFetchMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock, getPlatform: getPlatformMock },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: checkPermissionsMock,
    requestPermissions: requestPermissionsMock,
    register: registerMock,
    addListener: addListenerMock,
  },
}))

vi.mock('firebase/app', () => ({
  initializeApp: initializeAppMock,
}))

vi.mock('firebase/messaging', () => ({
  isSupported: isSupportedMock,
  getMessaging: getMessagingMock,
  getToken: getTokenMock,
  onMessage: onMessageMock,
}))

vi.mock('./httpClient', () => ({
  apiFetch: apiFetchMock,
}))

function requestBody(call: unknown[]): unknown {
  const init = call[1] as RequestInit
  return JSON.parse(init.body as string)
}

describe('setupWebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    isSupportedMock.mockResolvedValue(true)
    apiFetchMock.mockResolvedValue({ ok: true })
    getTokenMock.mockResolvedValue('web-token-1')
    getMessagingMock.mockReturnValue({})
    initializeAppMock.mockReturnValue({})

    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue({}) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests permission and registers the token when granted', async () => {
    const { setupWebPush } = await import('./push')

    await setupWebPush()

    expect(getTokenMock).toHaveBeenCalled()
    expect(apiFetchMock).toHaveBeenCalledWith('/me/push-tokens', expect.objectContaining({ method: 'POST' }))
    expect(requestBody(apiFetchMock.mock.calls[0])).toEqual({ platform: 'web', fcm_token: 'web-token-1' })
  })

  it('does not register when permission is denied', async () => {
    ;(globalThis as unknown as { Notification: typeof Notification }).Notification.requestPermission = vi
      .fn()
      .mockResolvedValue('denied')
    const { setupWebPush } = await import('./push')

    await setupWebPush()

    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('does not re-prompt when permission was already granted', async () => {
    const notification = (globalThis as unknown as { Notification: typeof Notification }).Notification
    ;(notification as unknown as { permission: string }).permission = 'granted'
    const requestPermission = vi.fn()
    notification.requestPermission = requestPermission
    const { setupWebPush } = await import('./push')

    await setupWebPush()

    expect(requestPermission).not.toHaveBeenCalled()
    expect(apiFetchMock).toHaveBeenCalled()
  })

  it('does not call the register endpoint again for the same token', async () => {
    const { setupWebPush } = await import('./push')
    await setupWebPush()
    apiFetchMock.mockClear()

    await setupWebPush()

    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('re-registers automatically when the browser token rotates', async () => {
    const { setupWebPush } = await import('./push')
    await setupWebPush()
    apiFetchMock.mockClear()
    getTokenMock.mockResolvedValue('web-token-2')

    await setupWebPush()

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(requestBody(apiFetchMock.mock.calls[0])).toEqual({ platform: 'web', fcm_token: 'web-token-2' })
  })
})

describe('setupNativePush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPlatformMock.mockReturnValue('android')
    checkPermissionsMock.mockResolvedValue({ receive: 'prompt' })
    requestPermissionsMock.mockResolvedValue({ receive: 'granted' })
    apiFetchMock.mockResolvedValue({ ok: true })
  })

  it('requests permission, registers, and posts the native token with the right platform', async () => {
    const { setupNativePush } = await import('./push')

    await setupNativePush()

    expect(registerMock).toHaveBeenCalled()
    const registrationHandler = addListenerMock.mock.calls.find((call) => call[0] === 'registration')?.[1] as (t: {
      value: string
    }) => Promise<void>
    expect(registrationHandler).toBeTruthy()

    await registrationHandler({ value: 'native-token-1' })

    expect(apiFetchMock).toHaveBeenCalledWith('/me/push-tokens', expect.objectContaining({ method: 'POST' }))
    expect(requestBody(apiFetchMock.mock.calls[0])).toEqual({ platform: 'android', fcm_token: 'native-token-1' })
  })

  it('does not register when permission is denied', async () => {
    requestPermissionsMock.mockResolvedValue({ receive: 'denied' })
    const { setupNativePush } = await import('./push')

    await setupNativePush()

    expect(registerMock).not.toHaveBeenCalled()
  })

  it('does not re-prompt when permission was already granted', async () => {
    checkPermissionsMock.mockResolvedValue({ receive: 'granted' })
    const { setupNativePush } = await import('./push')

    await setupNativePush()

    expect(requestPermissionsMock).not.toHaveBeenCalled()
    expect(registerMock).toHaveBeenCalled()
  })

  it('dispatches PUSH_NOTIFICATION_TAPPED_EVENT with the payload data on tap', async () => {
    const { setupNativePush, PUSH_NOTIFICATION_TAPPED_EVENT } = await import('./push')
    await setupNativePush()
    const tapHandler = addListenerMock.mock.calls.find((call) => call[0] === 'pushNotificationActionPerformed')?.[1] as (a: {
      notification: { data?: Record<string, string> }
    }) => void
    expect(tapHandler).toBeTruthy()

    const listener = vi.fn()
    window.addEventListener(PUSH_NOTIFICATION_TAPPED_EVENT, listener)
    tapHandler({ notification: { data: { type: 'vaga_waitlist', reference_type: 'booking', reference_id: 'b-1' } } })

    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ type: 'vaga_waitlist', reference_type: 'booking', reference_id: 'b-1' })

    window.removeEventListener(PUSH_NOTIFICATION_TAPPED_EVENT, listener)
  })
})

describe('setupPushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('delegates to native setup on native platforms', async () => {
    isNativePlatformMock.mockReturnValue(true)
    checkPermissionsMock.mockResolvedValue({ receive: 'denied' })
    const { setupPushNotifications } = await import('./push')

    await setupPushNotifications()

    expect(checkPermissionsMock).toHaveBeenCalled()
    expect(isSupportedMock).not.toHaveBeenCalled()
  })

  it('delegates to web setup on web', async () => {
    isNativePlatformMock.mockReturnValue(false)
    isSupportedMock.mockResolvedValue(false)
    const { setupPushNotifications } = await import('./push')

    await setupPushNotifications()

    expect(isSupportedMock).toHaveBeenCalled()
    expect(checkPermissionsMock).not.toHaveBeenCalled()
  })

  it('never throws even if setup fails', async () => {
    isNativePlatformMock.mockReturnValue(false)
    isSupportedMock.mockRejectedValue(new Error('boom'))
    const { setupPushNotifications } = await import('./push')

    await expect(setupPushNotifications()).resolves.toBeUndefined()
  })
})
