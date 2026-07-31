import './AuthDivider.css'

export interface AuthDividerProps {
  /** Rótulo central, ex.: "ou", "ou preencha". */
  label?: string
}

/**
 * Divisor com rótulo entre o bloco de login social e o formulário
 * (Figma node 278:1778). É agrupamento semântico, não decoração — o rótulo
 * é lido uma única vez pelo leitor de tela via aria-label no separador; as
 * linhas ficam aria-hidden.
 */
export function AuthDivider({ label = 'ou' }: AuthDividerProps) {
  return (
    <div className="auth-divider" role="separator" aria-label={label}>
      <span className="auth-divider__line" aria-hidden="true" />
      <span className="auth-divider__label" aria-hidden="true">
        {label}
      </span>
      <span className="auth-divider__line" aria-hidden="true" />
    </div>
  )
}
