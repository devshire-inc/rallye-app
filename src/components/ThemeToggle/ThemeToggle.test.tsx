import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../context/ThemeContext'
import LoginPage from '../../pages/LoginPage'
import { ThemeToggle } from './ThemeToggle'

// jsdom não expõe localStorage por padrão nesta config de vitest — mesmo
// polyfill mínimo em memória usado por src/lib/theme.test.ts.
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

function mockMatchMedia(matchesDark: boolean) {
  const mql = {
    matches: matchesDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return mql
}

const { checkExistingSessionMock, loginMock } = vi.hoisted(() => ({
  checkExistingSessionMock: vi.fn(),
  loginMock: vi.fn(),
}))

vi.mock('../../lib/httpClient', () => ({
  checkExistingSession: checkExistingSessionMock,
  login: loginMock,
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    mockMatchMedia(false)
    checkExistingSessionMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a native button with an accessible theme label', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: /tema/i })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('aria-pressed toggles on click', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: /tema/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('is operable natively via keyboard (Tab + Enter), no custom onKeyDown', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: /tema/i })
    expect(button).not.toHaveAttribute('onkeydown')

    await user.tab()
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('is reachable on /login, a public route outside AppShell', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']}>
          <ThemeToggle />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: /tema/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('CSS: fixed position, 46px control height, safe-area insets', () => {
    const css = readFileSync('src/components/ThemeToggle/ThemeToggle.css', 'utf8')
    expect(css).toMatch(/position:\s*fixed/)
    expect(css).toMatch(/width:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/env\(safe-area-inset-bottom/)
    expect(css).toMatch(/env\(safe-area-inset-right/)
  })
})
