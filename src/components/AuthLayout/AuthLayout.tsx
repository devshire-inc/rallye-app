import type { ReactNode } from 'react'
import './AuthLayout.css'

export interface AuthLayoutProps {
  /** Frase curta acima da marca, usada quando não há título (ex.: A1 login). */
  tagline?: ReactNode
  /** Título grande exibido na faixa "sky" (topo). */
  title?: ReactNode
  /** Texto de apoio abaixo do título, na faixa "sky". */
  subtitle?: ReactNode
  /** Marca "rallye." pequena, no canto superior esquerdo, no lugar do hz-mark central. */
  cornerMark?: boolean
  /** Marca "rallye." grande/central, sobre a linha do horizonte (padrão nas telas A1/A2/S1). */
  mark?: 'lg' | 'sm' | 'none'
  /** Formulário mais largo (A2/A5 etapa 1/3). */
  wide?: boolean
  /** Conteúdo do formulário, na faixa "sand" (base). */
  children: ReactNode
  /** Nota de rodapé opcional, abaixo do cartão de formulário. */
  hint?: ReactNode
}

/**
 * Shell visual "Horizon" (tema Saque Noturno) compartilhado por todas as
 * telas de autenticação (A1 login, A2 cadastro, A3 esqueci/redefinir senha,
 * A4 verificação de e-mail, A5 magic link de visitante, S1 seletor de
 * arena): uma faixa "sky" no topo com o título e uma faixa "sand" na base
 * com o formulário, e a marca "rallye." sentada sobre a linha do horizonte.
 *
 * Extraído do protótipo HTML de referência — ver AuthLayout.css para as
 * variáveis de cor/tipografia (definidas globalmente em src/index.css).
 */
export function AuthLayout({
  tagline,
  title,
  subtitle,
  cornerMark = false,
  mark = 'lg',
  wide = false,
  children,
  hint,
}: AuthLayoutProps) {
  return (
    <div className="horizon">
      <div className="hz-sky">
        {cornerMark && (
          <span className="hz-corner" aria-hidden="true">
            rallye<span className="dot">.</span>
          </span>
        )}
        {tagline && <div className="hz-tagline">{tagline}</div>}
        {title && <h1>{title}</h1>}
        {subtitle && <p className="sub">{subtitle}</p>}
        {mark !== 'none' && (
          <div className={`hz-mark ${mark}`} aria-hidden="true">
            <span className="m top">
              rallye<span className="dot">.</span>
            </span>
            <span className="m bot">
              rallye<span className="dot">.</span>
            </span>
          </div>
        )}
      </div>
      <div className="hz-sand">
        <div className={`hz-form${wide ? ' wide' : ''}`}>{children}</div>
        {hint && <div className="hint-note">{hint}</div>}
      </div>
    </div>
  )
}

export default AuthLayout
