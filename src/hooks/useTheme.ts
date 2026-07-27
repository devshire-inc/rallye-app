/**
 * Hook de leitura de ThemeContext (BEAC-2065) — mesma forma de
 * usePermissionsContext.ts. Lança fora de um ThemeProvider.
 */
import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from '../context/themeContextInstance'

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
