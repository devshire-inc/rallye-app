import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const colorsCss = readFileSync('src/styles/tokens/colors.css', 'utf8')
const effectsCss = readFileSync('src/styles/tokens/effects.css', 'utf8')

function extractBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`selector ${selector} not found`)
  return match[1]
}

function propValue(block: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`))
  if (!match) throw new Error(`property ${name} not found`)
  return match[1].trim()
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('colors.css — primitives', () => {
  const root = extractBlock(colorsCss, ':root')

  const primitives: Record<string, string> = {
    '--orange-700': '#C74609',
    '--orange-600': '#E05312',
    '--orange-500': '#F96420',
    '--orange-200': '#FFC7A3',
    '--orange-100': '#FFE4D1',
    '--orange-50': '#FFF3EA',
    '--navy-950': '#0F1B26',
    '--navy-900': '#182838',
    '--navy-800': '#22354A',
    '--navy-700': '#33475C',
    '--navy-500': '#5D7186',
    '--navy-300': '#9AA9BB',
    '--navy-200': '#C2CCD8',
    '--navy-100': '#E1E7ED',
    '--sand-50': '#FBF6ED',
    '--sand-100': '#F8EDDA',
    '--sand-200': '#F3E0C2',
    '--sand-300': '#E8CFA4',
    '--sand-400': '#D8B87F',
    '--amber-500': '#F6A821',
    '--amber-100': '#FDEFCF',
    '--white': '#FFFFFF',
    '--green-600': '#17915B',
    '--green-100': '#DCF3E7',
    '--red-600': '#D8452B',
    '--red-100': '#FAE2DC',
    '--blue-600': '#1E7FB5',
    '--blue-100': '#DEEFF8',
  }

  it.each(Object.entries(primitives))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  const sports: Record<string, string> = {
    '--sport-beach-tennis': '#F96420',
    '--sport-padel': '#1E7FB5',
    '--sport-futevolei': '#14808A',
    '--sport-volei': '#F6A821',
    '--sport-tenis': '#A8562F',
    '--sport-outro': '#5D7186',
  }

  it.each(Object.entries(sports))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })
})

describe('colors.css — semantic aliases, light vs dark defined independently', () => {
  const root = extractBlock(colorsCss, ':root')
  const dark = extractBlock(colorsCss, '[data-theme="dark"]')

  const lightValues: Record<string, string> = {
    '--surface-page': 'var(--sand-50)',
    '--surface-card': 'var(--white)',
    '--surface-sunken': 'var(--sand-100)',
    '--surface-inverse': 'var(--navy-900)',
    '--surface-brand': 'var(--orange-500)',
    '--surface-brand-soft': 'var(--orange-100)',
    '--text-heading': 'var(--navy-900)',
    '--text-body': 'var(--navy-700)',
    '--text-muted': 'var(--navy-500)',
    '--text-brand': 'var(--orange-700)',
    '--text-on-brand': '#FFFFFF',
    '--text-inverse': '#FDF8F0',
    '--border-default': '#EBDFC9',
    '--border-strong': 'var(--sand-400)',
    '--interactive-primary': 'var(--orange-500)',
    '--interactive-primary-hover': 'var(--orange-600)',
    '--interactive-primary-press': 'var(--orange-700)',
    '--focus-ring-color': 'var(--orange-700)',
    '--state-success': 'var(--green-600)',
    '--state-success-soft': 'var(--green-100)',
    '--state-warning': 'var(--amber-500)',
    '--state-warning-soft': 'var(--amber-100)',
    '--state-danger': 'var(--red-600)',
    '--state-danger-soft': 'var(--red-100)',
    '--state-info': 'var(--blue-600)',
    '--state-info-soft': 'var(--blue-100)',
    '--court-line': 'rgba(255,255,255,.35)',
    '--court-line-subtle': 'rgba(24,40,56,.08)',
  }

  it.each(Object.entries(lightValues))('light %s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  const darkValues: Record<string, string> = {
    '--surface-page': 'var(--navy-950)',
    '--surface-card': 'var(--navy-900)',
    '--surface-sunken': '#122030',
    '--surface-inverse': 'var(--sand-100)',
    '--surface-brand': 'var(--orange-500)',
    '--surface-brand-soft': 'rgba(249,100,32,.14)',
    '--text-heading': '#FDF8F0',
    '--text-body': '#D9E0E8',
    '--text-muted': '#8FA0B2',
    '--text-brand': '#FF9257',
    '--text-inverse': 'var(--navy-900)',
    '--border-default': '#2A3D52',
    '--border-strong': '#3D5169',
    '--focus-ring-color': 'var(--orange-500)',
    '--state-success-soft': 'rgba(23,145,91,.14)',
    '--state-warning-soft': 'rgba(246,168,33,.14)',
    '--state-danger-soft': 'rgba(216,69,43,.14)',
    '--state-info-soft': 'rgba(30,127,181,.14)',
    '--court-line-subtle': 'rgba(253,248,240,.09)',
  }

  it.each(Object.entries(darkValues))('dark %s = %s', (name, value) => {
    expect(propValue(dark, name)).toBe(value)
  })
})

describe('effects.css — shadows and motion', () => {
  const root = extractBlock(effectsCss, ':root')
  const dark = extractBlock(effectsCss, '[data-theme="dark"]')

  it('light shadow tokens match exactly', () => {
    expect(propValue(root, '--shadow-card')).toBe(
      '0 1px 2px rgba(24,40,56,.05),0 4px 14px rgba(24,40,56,.07)',
    )
    expect(propValue(root, '--shadow-raised')).toBe(
      '0 2px 4px rgba(24,40,56,.06),0 10px 26px rgba(24,40,56,.12)',
    )
    expect(propValue(root, '--shadow-overlay')).toBe(
      '0 8px 16px rgba(24,40,56,.10),0 24px 48px rgba(24,40,56,.20)',
    )
    expect(propValue(root, '--shadow-float-nav')).toBe('0px 4px 16px rgba(0,0,0,.1)')
  })

  it('dark shadow tokens are redefined independently, not derived', () => {
    expect(propValue(dark, '--shadow-card')).toBe(
      '0 1px 2px rgba(0,0,0,.3),0 4px 14px rgba(0,0,0,.35)',
    )
    expect(propValue(dark, '--shadow-raised')).toBe(
      '0 2px 4px rgba(0,0,0,.35),0 10px 26px rgba(0,0,0,.45)',
    )
    expect(propValue(dark, '--shadow-overlay')).toBe(
      '0 8px 16px rgba(0,0,0,.4),0 24px 48px rgba(0,0,0,.55)',
    )
    expect(propValue(dark, '--shadow-float-nav')).toBe('0 6px 24px rgba(0,0,0,.5)')
  })

  it('motion/easing tokens match exactly', () => {
    expect(propValue(root, '--ease-standard')).toBe('cubic-bezier(.2,.8,.3,1)')
    expect(propValue(root, '--ease-bounce')).toBe('cubic-bezier(.34,1.56,.64,1)')
    expect(propValue(root, '--dur-fast')).toBe('120ms')
    expect(propValue(root, '--dur-base')).toBe('200ms')
    expect(propValue(root, '--dur-slow')).toBe('320ms')
    expect(propValue(root, '--focus-ring')).toBe('0 0 0 3px var(--focus-ring-color)')
  })
})

describe('legacy compatibility bridge — 26 aliases in colors.css/effects.css', () => {
  const colorsRoot = extractBlock(colorsCss, ':root')
  const colorsDark = extractBlock(colorsCss, '[data-theme="dark"]')
  const effectsRoot = extractBlock(effectsCss, ':root')
  const effectsDark = extractBlock(effectsCss, '[data-theme="dark"]')

  const colorAliases: Record<string, string> = {
    '--bg': 'var(--surface-page)',
    '--surface': 'var(--surface-card)',
    '--border': 'var(--border-default)',
    '--text-primary': 'var(--text-heading)',
    '--accent': 'var(--interactive-primary)',
    '--on-accent': 'var(--text-on-brand)',
    '--sand': 'var(--sand-200)',
    '--teal': 'var(--interactive-primary)',
    '--sky': 'var(--surface-inverse)',
    '--sky-text': 'var(--text-inverse)',
    '--sky-muted': 'var(--text-muted)',
    '--hz-top': 'var(--surface-page)',
    '--hz-bot': 'var(--surface-inverse)',
    '--success-bg': 'var(--state-success-soft)',
    '--success-fg': 'var(--state-success)',
    '--warning-bg': 'var(--state-warning-soft)',
    '--warning-fg': 'var(--state-warning)',
    '--error-bg': 'var(--state-danger-soft)',
    '--error-fg': 'var(--state-danger)',
    '--data': 'var(--state-info)',
    '--data-soft': 'var(--state-info-soft)',
    '--link': 'var(--interactive-primary)',
    '--scrim': 'rgba(15,27,38,.5)',
  }

  const effectsAliases: Record<string, string> = {
    '--ease-enter': 'var(--ease-standard)',
    '--motion-fast': 'var(--dur-fast)',
    '--motion-slow': 'var(--dur-slow)',
  }

  it('all 26 aliases accounted for', () => {
    expect(Object.keys(colorAliases).length + Object.keys(effectsAliases).length).toBe(26)
  })

  it.each(Object.entries(colorAliases))('light colors.css alias %s -> %s', (name, value) => {
    expect(propValue(colorsRoot, name)).toBe(value)
  })

  it.each(Object.entries(colorAliases))('dark colors.css alias %s -> %s', (name, value) => {
    expect(propValue(colorsDark, name)).toBe(value)
  })

  it.each(Object.entries(effectsAliases))('light effects.css alias %s -> %s', (name, value) => {
    expect(propValue(effectsRoot, name)).toBe(value)
  })

  it.each(Object.entries(effectsAliases))('dark effects.css alias %s -> %s', (name, value) => {
    expect(propValue(effectsDark, name)).toBe(value)
  })
})

describe('boundaries', () => {
  it('no @media (prefers-color-scheme in either file', () => {
    expect(colorsCss).not.toMatch(/@media\s*\(\s*prefers-color-scheme/)
    expect(effectsCss).not.toMatch(/@media\s*\(\s*prefers-color-scheme/)
  })

  it('no radius or spacing tokens defined in colors.css/effects.css', () => {
    expect(colorsCss).not.toMatch(/--radius-card\s*:/)
    expect(colorsCss).not.toMatch(/--radius-input\s*:/)
    expect(colorsCss).not.toMatch(/--space-\d+\s*:/)
    expect(effectsCss).not.toMatch(/--radius-card\s*:/)
    expect(effectsCss).not.toMatch(/--radius-input\s*:/)
    expect(effectsCss).not.toMatch(/--space-\d+\s*:/)
  })
})

describe('amendment — --state-warning-text contrast fix', () => {
  const root = extractBlock(colorsCss, ':root')
  const dark = extractBlock(colorsCss, '[data-theme="dark"]')

  it('exists in :root, no override in dark', () => {
    expect(propValue(root, '--state-warning-text')).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(() => propValue(dark, '--state-warning-text')).toThrow()
  })

  it('warning-soft references amber-100, real contrast >= 4.5:1 (WCAG AA)', () => {
    const wt = colorsCss.match(/--state-warning-text:\s*#([0-9a-fA-F]{6})/)
    expect(wt).not.toBeNull()
    expect(colorsCss).toMatch(/--state-warning-soft:\s*var\(--amber-100\)/)
    const a100 = colorsCss.match(/--amber-100:\s*#([0-9a-fA-F]{6})/)
    expect(a100).not.toBeNull()
    expect(contrastRatio(wt![1], a100![1])).toBeGreaterThanOrEqual(4.5)
  })
})
