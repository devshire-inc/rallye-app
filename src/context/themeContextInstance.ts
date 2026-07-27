/**
 * Instância crua do React Context de ThemeContext (BEAC-2065) — vive num
 * módulo próprio, separado de ThemeContext.tsx (que só exporta o
 * componente `ThemeProvider`, exigido pelo eslint
 * react-refresh/only-export-components) e de ../hooks/useTheme.ts (que só
 * exporta o hook). Mesmo padrão de ../context/permissionsContextInstance.ts.
 */
import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from '../lib/theme'

export interface ThemeContextValue {
  theme: ResolvedTheme
  preference: ThemePreference
  setTheme: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
