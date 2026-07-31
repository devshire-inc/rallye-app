import type { ReactNode } from 'react'
import { BrandLogo } from '../Icon/BrandLogo'
import './SocialAuthButton.css'

export type SocialAuthButtonLogoName = 'google' | 'apple' | 'whatsapp'

export interface SocialAuthButtonProps {
  /** Visual treatment. Light uses fixed white/navy-900 (Apple brand
   * requirement: the white button never inverts in dark mode) — see
   * doc/ANATOMIA E TOKENS. */
  style?: 'outline' | 'dark' | 'light'
  label?: string
  /**
   * Logo slot. Pass one of the known brand names to render the real
   * `BrandLogo` SVG, or a custom `ReactNode` for anything else. Omit for
   * the neutral dashed placeholder (matches the Figma "logo / Placeholder"
   * instance-swap default) — swap it for a real brand logo before
   * shipping any new usage.
   */
  logo?: SocialAuthButtonLogoName | ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}

const KNOWN_LOGO_NAMES: SocialAuthButtonLogoName[] = ['google', 'apple', 'whatsapp']

function isKnownLogoName(logo: unknown): logo is SocialAuthButtonLogoName {
  return typeof logo === 'string' && (KNOWN_LOGO_NAMES as string[]).includes(logo)
}

/**
 * Full-width social login button (Figma node 278:1626) — Google/Apple/etc.
 * Style (Outline/Dark/Light) x State (Default/Focus/Disabled).
 */
export function SocialAuthButton({
  style = 'outline',
  label = 'Continuar com Google',
  logo,
  disabled = false,
  onClick,
  type = 'button',
}: SocialAuthButtonProps) {
  let logoNode: ReactNode
  if (isKnownLogoName(logo)) {
    // Apple's brand guidelines require the logo color to invert with the
    // button's own fixed background, never with the app theme.
    logoNode =
      logo === 'apple' ? (
        <BrandLogo name="apple" variant={style === 'dark' ? 'white' : 'black'} size={20} />
      ) : (
        <BrandLogo name={logo} size={20} />
      )
  } else if (logo) {
    logoNode = logo
  } else {
    logoNode = <span className="social-auth-button__logo-placeholder" aria-hidden="true" />
  }

  return (
    <button
      type={type}
      className={`social-auth-button social-auth-button--${style}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="social-auth-button__logo">{logoNode}</span>
      <span className="social-auth-button__label">{label}</span>
    </button>
  )
}
