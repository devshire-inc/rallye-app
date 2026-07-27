/**
 * Mecanismo de tema (BEAC-2065, story BEAC-1734): funções puras/síncronas,
 * livres de React, chamadas tanto pelo bootstrap pré-paint de main.tsx
 * quanto por ThemeContext.tsx. `applyInitialTheme()` precisa rodar
 * sincronamente ANTES do primeiro render do React (nunca em `useEffect`,
 * que só roda depois do 1o paint) para não haver flash de tema errado.
 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'rallye-theme-preference'

/** Preferência salva; `'system'` tanto na ausência quanto num valor
 * corrompido/inválido — nunca lança, sempre um fallback seguro. */
export function readStoredPreference(): ThemePreference {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function storePreference(preference: ThemePreference): void {
  if (preference === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, preference)
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Lê a preferência salva, resolve e aplica `data-theme` no elemento raiz.
 * Chamada sincronamente em main.tsx, antes de `createRoot(...).render(...)`. */
export function applyInitialTheme(): ThemePreference {
  const preference = readStoredPreference()
  document.documentElement.dataset.theme = resolveTheme(preference)
  return preference
}
