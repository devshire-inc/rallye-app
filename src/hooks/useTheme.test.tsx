import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../context/ThemeContext'
import { useTheme } from './useTheme'

// jsdom não expõe localStorage por padrão nesta config de vitest — mesmo
// polyfill mínimo em memória usado por src/lib/push.test.ts e
// src/lib/theme.test.ts, escopado a este arquivo de teste.
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
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  const mql = {
    matches: matchesDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener,
    removeEventListener,
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return mql
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws outside a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/)
  })

  it('setTheme updates state and data-theme synchronously', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    })

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(result.current.preference).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('setTheme("system") goes back to following matchMedia', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    })

    act(() => {
      result.current.setTheme('light')
    })
    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.setTheme('system')
    })

    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('registers the matchMedia listener only when preference is system, removes it when switching away', () => {
    const mql = mockMatchMedia(false)

    function Probe() {
      const { setTheme } = useTheme()
      return <button onClick={() => setTheme('dark')}>switch</button>
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mql.removeEventListener).not.toHaveBeenCalled()

    act(() => {
      screen.getByText('switch').click()
    })

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('does not register a matchMedia listener when starting from an explicit preference', () => {
    localStorage.setItem('rallye-theme-preference', 'dark')
    const mql = mockMatchMedia(false)

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    )

    expect(mql.addEventListener).not.toHaveBeenCalled()
  })
})
