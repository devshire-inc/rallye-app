import type { CSSProperties } from 'react'
import './BrandLogo.css'

import googleSrc from './logos/google.svg'
import whatsappSrc from './logos/whatsapp.svg'
import pixSrc from './logos/pix.svg'
import appleBlackSrc from './logos/apple-black.svg'
import appleWhiteSrc from './logos/apple-white.svg'
import rallyeMarkDarkSrc from './logos/rallye-mark-dark.svg'
import rallyeMarkLightSrc from './logos/rallye-mark-light.svg'
import rallyeLockupDarkSrc from './logos/rallye-lockup-dark.svg'
import rallyeLockupLightSrc from './logos/rallye-lockup-light.svg'

export type AppleVariant = 'black' | 'white'
export type RallyeVariant = 'dark' | 'light'

interface BrandLogoBaseProps {
  /** Lado do quadrado (ou largura, para o lockup) em px. */
  size?: number
  className?: string
}

export type BrandLogoProps =
  | ({ name: 'google' | 'whatsapp' | 'pix' } & BrandLogoBaseProps)
  | ({ name: 'apple'; variant?: AppleVariant } & BrandLogoBaseProps)
  | ({ name: 'rallye-mark' | 'rallye-lockup'; variant?: RallyeVariant } & BrandLogoBaseProps)

export type BrandLogoName = BrandLogoProps['name']

/** Cor fixa por marca (Figma node 341:117, seção MARCAS) — NÃO usa currentColor
 * nem token de tema, ao contrário de `<Icon>`. A troca de variante (Apple
 * Black/White, Rallye Dark/Light) é sempre manual via prop, nunca automática
 * por dark mode. */
export function BrandLogo(props: BrandLogoProps) {
  const { size = 24, className } = props
  const style = { '--brand-logo-size': `${size}px` } as CSSProperties

  let src: string

  switch (props.name) {
    case 'google':
      src = googleSrc
      break
    case 'whatsapp':
      src = whatsappSrc
      break
    case 'pix':
      src = pixSrc
      break
    case 'apple':
      src = props.variant === 'white' ? appleWhiteSrc : appleBlackSrc
      break
    case 'rallye-mark':
      src = props.variant === 'light' ? rallyeMarkLightSrc : rallyeMarkDarkSrc
      break
    case 'rallye-lockup':
      src = props.variant === 'light' ? rallyeLockupLightSrc : rallyeLockupDarkSrc
      break
  }

  return (
    // Decorativo por padrão, mesmo racional do Icon: em todo uso conhecido
    // (Social Auth Button, footer) a marca vem ao lado de um rótulo de texto
    // visível que já carrega o significado.
    <img
      className={className ? `brand-logo ${className}` : 'brand-logo'}
      style={style}
      src={src}
      alt=""
    />
  )
}
