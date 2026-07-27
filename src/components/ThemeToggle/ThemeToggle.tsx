import { useTheme } from '../../hooks/useTheme'
import './ThemeToggle.css'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={isDark}
      aria-label={
        isDark
          ? 'Tema escuro ativo. Tocar para mudar para o tema claro.'
          : 'Tema claro ativo. Tocar para mudar para o tema escuro.'
      }
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  )
}
