import type { CSSProperties } from 'react'
import './Icon.css'

import alertTriangleSvg from './icons/alert-triangle.svg?raw'
import barChartSvg from './icons/bar-chart.svg?raw'
import bellSvg from './icons/bell.svg?raw'
import bracketSvg from './icons/bracket.svg?raw'
import calendarSvg from './icons/calendar.svg?raw'
import calendarCheckSvg from './icons/calendar-check.svg?raw'
import cameraSvg from './icons/camera.svg?raw'
import checkSvg from './icons/check.svg?raw'
import checkCircleSvg from './icons/check-circle.svg?raw'
import chevronDownSvg from './icons/chevron-down.svg?raw'
import chevronLeftSvg from './icons/chevron-left.svg?raw'
import chevronRightSvg from './icons/chevron-right.svg?raw'
import chevronUpSvg from './icons/chevron-up.svg?raw'
import clockSvg from './icons/clock.svg?raw'
import closeSvg from './icons/close.svg?raw'
import copySvg from './icons/copy.svg?raw'
import creditCardSvg from './icons/credit-card.svg?raw'
import dollarSignSvg from './icons/dollar-sign.svg?raw'
import downloadSvg from './icons/download.svg?raw'
import editSvg from './icons/edit.svg?raw'
import eyeSvg from './icons/eye.svg?raw'
import eyeOffSvg from './icons/eye-off.svg?raw'
import filterSvg from './icons/filter.svg?raw'
import homeSvg from './icons/home.svg?raw'
import imageSvg from './icons/image.svg?raw'
import infoSvg from './icons/info.svg?raw'
import linkSvg from './icons/link.svg?raw'
import logoutSvg from './icons/logout.svg?raw'
import mailSvg from './icons/mail.svg?raw'
import mapPinSvg from './icons/map-pin.svg?raw'
import medalSvg from './icons/medal.svg?raw'
import minusSvg from './icons/minus.svg?raw'
import moreVerticalSvg from './icons/more-vertical.svg?raw'
import phoneSvg from './icons/phone.svg?raw'
import plugSvg from './icons/plug.svg?raw'
import plusSvg from './icons/plus.svg?raw'
import qrCodeSvg from './icons/qr-code.svg?raw'
import rankingSvg from './icons/ranking.svg?raw'
import receiptSvg from './icons/receipt.svg?raw'
import searchSvg from './icons/search.svg?raw'
import settingsSvg from './icons/settings.svg?raw'
import settingsAltSvg from './icons/settings-alt.svg?raw'
import shareSvg from './icons/share.svg?raw'
import shieldSvg from './icons/shield.svg?raw'
import sportTennisSvg from './icons/sport-tennis.svg?raw'
import sportVolleyballSvg from './icons/sport-volleyball.svg?raw'
import starSvg from './icons/star.svg?raw'
import storeSvg from './icons/store.svg?raw'
import sunSvg from './icons/sun.svg?raw'
import swapSvg from './icons/swap.svg?raw'
import trashSvg from './icons/trash.svg?raw'
import trophySvg from './icons/trophy.svg?raw'
import uploadSvg from './icons/upload.svg?raw'
import userSvg from './icons/user.svg?raw'
import userCircleSvg from './icons/user-circle.svg?raw'
import usersSvg from './icons/users.svg?raw'
import whistleSvg from './icons/whistle.svg?raw'
import xCircleSvg from './icons/x-circle.svg?raw'

// Figma canvas "Icons" (node 115:2) — catálogo publicado, 24×24 / stroke 2px.
// sport-padel, sport-beach-tennis e sport-futevolei ficam de fora: marcados
// como rascunho/backlog não resolvido em node 175:139 ("TODO — Ícones
// faltantes"), não fazem parte do catálogo publicado.
export type IconName =
  | 'alert-triangle'
  | 'bar-chart'
  | 'bell'
  | 'bracket'
  | 'calendar'
  | 'calendar-check'
  | 'camera'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'close'
  | 'copy'
  | 'credit-card'
  | 'dollar-sign'
  | 'download'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'filter'
  | 'home'
  | 'image'
  | 'info'
  | 'link'
  | 'logout'
  | 'mail'
  | 'map-pin'
  | 'medal'
  | 'minus'
  | 'more-vertical'
  | 'phone'
  | 'plug'
  | 'plus'
  | 'qr-code'
  | 'ranking'
  | 'receipt'
  | 'search'
  | 'settings'
  | 'settings-alt'
  | 'share'
  | 'shield'
  | 'sport-tennis'
  | 'sport-volleyball'
  | 'star'
  | 'store'
  | 'sun'
  | 'swap'
  | 'trash'
  | 'trophy'
  | 'upload'
  | 'user'
  | 'user-circle'
  | 'users'
  | 'whistle'
  | 'x-circle'

const ICONS: Record<IconName, string> = {
  'alert-triangle': alertTriangleSvg,
  'bar-chart': barChartSvg,
  bell: bellSvg,
  bracket: bracketSvg,
  calendar: calendarSvg,
  'calendar-check': calendarCheckSvg,
  camera: cameraSvg,
  check: checkSvg,
  'check-circle': checkCircleSvg,
  'chevron-down': chevronDownSvg,
  'chevron-left': chevronLeftSvg,
  'chevron-right': chevronRightSvg,
  'chevron-up': chevronUpSvg,
  clock: clockSvg,
  close: closeSvg,
  copy: copySvg,
  'credit-card': creditCardSvg,
  'dollar-sign': dollarSignSvg,
  download: downloadSvg,
  edit: editSvg,
  eye: eyeSvg,
  'eye-off': eyeOffSvg,
  filter: filterSvg,
  home: homeSvg,
  image: imageSvg,
  info: infoSvg,
  link: linkSvg,
  logout: logoutSvg,
  mail: mailSvg,
  'map-pin': mapPinSvg,
  medal: medalSvg,
  minus: minusSvg,
  'more-vertical': moreVerticalSvg,
  phone: phoneSvg,
  plug: plugSvg,
  plus: plusSvg,
  'qr-code': qrCodeSvg,
  ranking: rankingSvg,
  receipt: receiptSvg,
  search: searchSvg,
  settings: settingsSvg,
  'settings-alt': settingsAltSvg,
  share: shareSvg,
  shield: shieldSvg,
  'sport-tennis': sportTennisSvg,
  'sport-volleyball': sportVolleyballSvg,
  star: starSvg,
  store: storeSvg,
  sun: sunSvg,
  swap: swapSvg,
  trash: trashSvg,
  trophy: trophySvg,
  upload: uploadSvg,
  user: userSvg,
  'user-circle': userCircleSvg,
  users: usersSvg,
  whistle: whistleSvg,
  'x-circle': xCircleSvg,
}

/** Todos os nomes de ícone válidos, na ordem do catálogo — usado pela grade do Storybook. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps {
  name: IconName
  /** Lado do quadrado em px (o ícone é sempre desenhado em 24×24 e escala mantendo o traço 2px — ver Figma node 250:398, "doc/icon-scaling"). */
  size?: number
  /** Decorativo por padrão (par com um rótulo de texto visível) — passe `false` quando o ícone for o único conteúdo acessível do elemento. */
  ariaHidden?: boolean
  className?: string
}

/**
 * Ícone genérico do catálogo (Figma node 115:2), renderizado inline para herdar
 * `color` via `currentColor` — ao contrário de `<img>`, permite que o traço
 * acompanhe o texto ao redor e o tema claro/escuro sem precisar de variante por cor.
 */
export function Icon({ name, size = 24, ariaHidden = true, className }: IconProps) {
  const markup = ICONS[name]
  if (!markup) return null

  const style = { '--icon-size': `${size}px` } as CSSProperties

  return (
    <span
      className={className ? `icon ${className}` : 'icon'}
      style={style}
      aria-hidden={ariaHidden}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
