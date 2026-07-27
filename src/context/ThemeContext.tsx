/**
 * ThemeProvider (BEAC-2065, story BEAC-1734) — espelha PermissionsContext.tsx
 * na separação de arquivos (Provider aqui, Context+tipos em
 * ./themeContextInstance.ts, hook de leitura em ../hooks/useTheme.ts).
 *
 * Estado inicial lido de localStorage (via readStoredPreference), já
 * consistente com o `data-theme` que main.tsx aplicou sincronamente antes do
 * 1o render (src/lib/theme.ts). O efeito abaixo só assina
 * matchMedia('(prefers-color-scheme: dark)') quando a preferência atual é
 * 'system' — com early-return e cleanup real via removeEventListener nos
 * demais casos, para nunca reagir a mudança do SO quando o usuário escolheu
 * um tema explícito.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  readStoredPreference,
  resolveTheme,
  storePreference,
  type ThemePreference,
} from '../lib/theme'
import { ThemeContext } from './themeContextInstance'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference())

  useEffect(() => {
    if (preference !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      document.documentElement.dataset.theme = resolveTheme('system')
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [preference])

  const setTheme = useCallback((next: ThemePreference) => {
    storePreference(next)
    document.documentElement.dataset.theme = resolveTheme(next)
    setPreference(next)
  }, [])

  const value = useMemo(
    () => ({
      theme: resolveTheme(preference),
      preference,
      setTheme,
    }),
    [preference, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
