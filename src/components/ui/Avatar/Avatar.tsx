import type { CSSProperties } from 'react'
import './Avatar.css'

export interface AvatarProps {
  name?: string
  size?: number
  src?: string
}

const AVATAR_COLOR_TOKENS = [
  '--sport-beach-tennis',
  '--sport-padel',
  '--sport-futevolei',
  '--sport-volei',
  '--sport-tenis',
] as const

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0] + words[1]![0]).toUpperCase()
}

function colorTokenFor(name: string): (typeof AVATAR_COLOR_TOKENS)[number] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_COLOR_TOKENS.length
  }
  return AVATAR_COLOR_TOKENS[hash]!
}

export function Avatar({ name, size = 40, src }: AvatarProps) {
  const sizeStyle = { '--avatar-size': `${size}px` } as CSSProperties

  if (src) {
    return <img className="avatar" style={sizeStyle} src={src} alt={name ?? ''} />
  }

  const displayName = name ?? '?'
  const style = {
    ...sizeStyle,
    '--avatar-color': `var(${colorTokenFor(displayName)})`,
  } as CSSProperties

  return (
    <span className="avatar avatar--initials" style={style}>
      {initialsOf(displayName)}
    </span>
  )
}
