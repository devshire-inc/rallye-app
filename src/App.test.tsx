import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// jsdom não expõe localStorage por padrão nesta config de vitest — mesmo
// polyfill mínimo em memória usado por src/lib/theme.test.ts. Necessário
// aqui desde BEAC-2065: App() agora monta ThemeProvider globalmente, que lê
// localStorage já no primeiro render.
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

// jsdom também não implementa matchMedia — ThemeProvider chama
// resolveTheme('system') no mount inicial (nenhuma preferência salva nos
// testes abaixo), que depende disso.
window.matchMedia = vi.fn().mockReturnValue({
  matches: false,
  media: '(prefers-color-scheme: dark)',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}) as unknown as typeof window.matchMedia

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

  it('renders the forgot-password page at /esqueci-senha', async () => {
    setPath('/esqueci-senha')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /esqueci minha senha/i })).toBeInTheDocument()
  })

  it('renders the reset-password page at /redefinir-senha', async () => {
    setPath('/redefinir-senha')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /redefinir senha/i })).toBeInTheDocument()
  })

  it('renders the email verification screen at /verify-email (A4)', async () => {
    setPath('/verify-email')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /verificação de e-mail/i })).toBeInTheDocument()
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
