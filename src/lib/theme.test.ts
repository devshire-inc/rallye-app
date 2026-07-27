import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyInitialTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
} from './theme'

// jsdom não expõe localStorage por padrão nesta config de vitest — mesmo
// polyfill mínimo em memória usado por src/lib/push.test.ts, escopado a
// este arquivo de teste.
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
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    matches: matchesDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb)
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb)
    }),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return mql
}

describe('theme.ts', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('resolveTheme', () => {
    it('returns light/dark as-is when preference is explicit', () => {
      mockMatchMedia(true)
      expect(resolveTheme('light')).toBe('light')
      expect(resolveTheme('dark')).toBe('dark')
    })

    it('follows matchMedia when preference is system', () => {
      mockMatchMedia(true)
      expect(resolveTheme('system')).toBe('dark')

      mockMatchMedia(false)
      expect(resolveTheme('system')).toBe('light')
    })
  })

  describe('readStoredPreference', () => {
    it('returns system when nothing is stored', () => {
      expect(readStoredPreference()).toBe('system')
    })

    it('returns the stored value for light/dark', () => {
      localStorage.setItem('rallye-theme-preference', 'dark')
      expect(readStoredPreference()).toBe('dark')
      localStorage.setItem('rallye-theme-preference', 'light')
      expect(readStoredPreference()).toBe('light')
    })

    it('treats an invalid/corrupted stored value as system, without throwing', () => {
      localStorage.setItem('rallye-theme-preference', 'azul')
      expect(() => readStoredPreference()).not.toThrow()
      expect(readStoredPreference()).toBe('system')
    })
  })

  describe('storePreference', () => {
    it('removes the key for system', () => {
      localStorage.setItem('rallye-theme-preference', 'dark')
      storePreference('system')
      expect(localStorage.getItem('rallye-theme-preference')).toBeNull()
    })

    it('writes the key for light/dark', () => {
      storePreference('dark')
      expect(localStorage.getItem('rallye-theme-preference')).toBe('dark')
      storePreference('light')
      expect(localStorage.getItem('rallye-theme-preference')).toBe('light')
    })
  })

  describe('applyInitialTheme', () => {
    it('sets data-theme following the stored preference and returns it', () => {
      mockMatchMedia(false)
      localStorage.setItem('rallye-theme-preference', 'dark')

      const preference = applyInitialTheme()

      expect(preference).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('sets data-theme following matchMedia when preference is system', () => {
      mockMatchMedia(true)

      const preference = applyInitialTheme()

      expect(preference).toBe('system')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })
})

describe('main.tsx — pre-paint ordering', () => {
  it('calls applyInitialTheme() before createRoot(...).render(', () => {
    const source = readFileSync('src/main.tsx', 'utf8')
    const applyIndex = source.indexOf('applyInitialTheme()')
    const renderIndex = source.indexOf('.render(')

    expect(applyIndex).toBeGreaterThan(-1)
    expect(renderIndex).toBeGreaterThan(-1)
    expect(applyIndex).toBeLessThan(renderIndex)
  })
})
