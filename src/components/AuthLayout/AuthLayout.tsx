import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '../ui/Icon/BrandLogo'
import { Icon } from '../ui/Icon/Icon'
import { IconButton } from '../ui/IconButton/IconButton'
import { useLongPress } from '../../hooks/useLongPress'
import { S1_PATH } from '../../lib/redirectTarget'
import './AuthLayout.css'

export interface AuthLayoutProps {
  /**
   * Título de marca/marketing (ex.: "Bora pra quadra!"). Sempre visível no
   * Brand Panel do desktop (≥`BREAKPOINT_SHELL_DESKTOP_MIN`); no mobile só
   * aparece quando `hero` é true.
   */
  heroTitle?: ReactNode
  /** Subtítulo de marca, mesma visibilidade de `heroTitle`. */
  heroSubtitle?: ReactNode
  /**
   * Ativa o hero de tela cheia no mobile (marca + heroTitle/heroSubtitle
   * sobre fundo escuro, como em Login/Splash). Sem isso, o mobile pula
   * direto para o conteúdo do formulário — com um selo compacto da marca no
   * topo, no lugar do hero, para preservar o long-press (BEAC-1835) em toda
   * tela. No desktop o Brand Panel aparece sempre, independente desta prop.
   */
  hero?: boolean
  /** Título do formulário em si (ex.: "Entrar", "Confira seu e-mail"). */
  title?: ReactNode
  /** Texto de apoio abaixo do título do formulário. */
  subtitle?: ReactNode
  /** Mostra o botão "Voltar" no topo do painel de formulário. */
  onBack?: () => void
  /** Formulário mais largo (Cadastro, Convidado). */
  wide?: boolean
  /**
   * Override explícito do `max-width` da coluna de conteúdo, em px. Usado
   * pela S1 real (grade de arenas foge da largura padrão de formulário).
   * Tem prioridade sobre `wide` quando setado.
   */
  formMaxWidth?: number
  /** Conteúdo do formulário. */
  children: ReactNode
  /** Nota de rodapé opcional, abaixo do cartão de formulário. */
  hint?: ReactNode
}

/**
 * Shell "Auth" compartilhado por todas as telas de autenticação (Login,
 * Cadastro, Esqueci/Redefinir senha, Verificação de e-mail, Convidado,
 * Completar cadastro, S1 seletor de arena): no mobile é uma coluna única
 * (opcionalmente com hero de marca no topo); a partir de
 * `BREAKPOINT_SHELL_DESKTOP_MIN` vira uma tela dividida — Brand Panel fixo à
 * esquerda + Form Panel centralizado à direita.
 *
 * Reconstruído a partir do protótipo Figma "Rallye — Protótipo" (canvases
 * "Auth — Mobile"/"Auth — Desktop") — ver AuthLayout.css para a
 * implementação visual (cores/tipografia vêm dos tokens globais).
 */
export function AuthLayout({
  heroTitle,
  heroSubtitle,
  hero = false,
  title,
  subtitle,
  onBack,
  wide = false,
  formMaxWidth,
  children,
  hint,
}: AuthLayoutProps) {
  const navigate = useNavigate()
  // BEAC-1835: "Acessível via long-press no logo Rallye, de qualquer tela do
  // app" — AuthLayout é a shell compartilhada por todas as telas de auth,
  // então ligar aqui cobre todas de uma vez. Um toque/clique curto continua
  // sem fazer nada (só o press sustentado navega). Como o mark do Brand
  // Panel some no mobile quando `hero` é false, o selo compacto abaixo
  // carrega os mesmos handlers para que o gesto continue disponível ali.
  const longPress = useLongPress(() => navigate(S1_PATH))

  return (
    <div className={`auth-shell${hero ? ' auth-shell--hero' : ''}`}>
      <div className="auth-shell__brand">
        <div className="auth-shell__badge auth-shell__badge--pressable" aria-hidden="true" {...longPress}>
          <BrandLogo name="rallye-mark" variant="dark" size={28} />
        </div>
        {heroTitle && <p className="auth-shell__brand-title">{heroTitle}</p>}
        {heroSubtitle && <p className="auth-shell__brand-subtitle">{heroSubtitle}</p>}
      </div>

      <div className="auth-shell__panel">
        <div
          className={`auth-shell__panel-inner${wide ? ' wide' : ''}`}
          style={formMaxWidth ? { maxWidth: formMaxWidth } : undefined}
        >
          {(onBack || !hero) && (
            <div className="auth-shell__header-row">
              {onBack && (
                <IconButton variant="secondary" size="md" label="Voltar" onClick={onBack}>
                  <Icon name="chevron-left" />
                </IconButton>
              )}
              {!hero && (
                <div
                  className="auth-shell__compact-mark auth-shell__compact-mark--pressable"
                  aria-hidden="true"
                  {...longPress}
                >
                  <BrandLogo name="rallye-mark" variant="dark" size={18} />
                </div>
              )}
            </div>
          )}
          {title && <h1 className="auth-shell__title">{title}</h1>}
          {subtitle && <p className="auth-shell__subtitle">{subtitle}</p>}
          <div className="auth-shell__form">{children}</div>
          {hint && <div className="hint-note">{hint}</div>}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
