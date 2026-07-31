import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const typographyCss = readFileSync('src/styles/tokens/typography.css', 'utf8')
const spacingCss = readFileSync('src/styles/tokens/spacing.css', 'utf8')

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

describe('typography.css — font families', () => {
  const root = extractBlock(typographyCss, ':root')

  it('font-display/-body/-mono match exactly, no theme variation', () => {
    expect(propValue(root, '--font-display')).toBe("'Baloo 2','Nunito',system-ui,sans-serif")
    expect(propValue(root, '--font-body')).toBe("'Nunito',system-ui,sans-serif")
    expect(propValue(root, '--font-mono')).toBe("'Spline Sans Mono',ui-monospace,monospace")
  })

  it('no [data-theme="dark"] block in typography.css', () => {
    expect(typographyCss).not.toMatch(/\[data-theme=["']dark["']\]/)
  })
})

describe('typography.css — --type-* shorthands', () => {
  const root = extractBlock(typographyCss, ':root')

  const types: Record<string, string> = {
    '--type-display-xl': '800 44px/1.05 var(--font-display)',
    '--type-display': '800 32px/1.1 var(--font-display)',
    '--type-title': '700 24px/1.2 var(--font-display)',
    '--type-heading': '700 19px/1.3 var(--font-display)',
    '--type-subtitle': '700 16px/1.35 var(--font-body)',
    '--type-body-lg': '400 17px/1.55 var(--font-body)',
    '--type-body': '400 15px/1.5 var(--font-body)',
    '--type-small': '400 13px/1.45 var(--font-body)',
    '--type-label': '700 13px/1.2 var(--font-body)',
    '--type-overline': '800 11px/1.2 var(--font-body)',
    '--type-numeric': '600 15px/1.3 var(--font-mono)',
    '--type-score': '800 28px/1 var(--font-display)',
  }

  it.each(Object.entries(types))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  it('--tracking-overline = .09em', () => {
    expect(propValue(root, '--tracking-overline')).toBe('.09em')
  })
})

describe('typography.css — no collision with colors.css --text-* tokens', () => {
  const forbidden = [
    '--text-display-xl',
    '--text-display',
    '--text-title',
    '--text-heading',
    '--text-subtitle',
    '--text-body-lg',
    '--text-body',
    '--text-small',
    '--text-label',
    '--text-overline',
    '--text-numeric',
    '--text-score',
  ]

  it.each(forbidden)('%s is not defined in typography.css', (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(typographyCss).not.toMatch(new RegExp(`${escaped}\\s*:`))
  })
})

describe('spacing.css — space scale, radius, control heights, page dims', () => {
  const root = extractBlock(spacingCss, ':root')

  const spaces: Record<string, string> = {
    '--space-1': '4px',
    '--space-2': '8px',
    '--space-3': '12px',
    '--space-4': '16px',
    '--space-5': '20px',
    '--space-6': '24px',
    '--space-8': '32px',
    '--space-10': '40px',
    '--space-12': '48px',
    '--space-16': '64px',
  }

  it.each(Object.entries(spaces))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  const radii: Record<string, string> = {
    '--radius-sm': '10px',
    '--radius-md': '14px',
    '--radius-lg': '18px',
    '--radius-xl': '24px',
    '--radius-pill': '999px',
  }

  it.each(Object.entries(radii))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  const controls: Record<string, string> = {
    '--control-h-sm': '44px',
    '--control-h-md': '46px',
    '--control-h-lg': '54px',
  }

  it.each(Object.entries(controls))('%s = %s', (name, value) => {
    expect(propValue(root, name)).toBe(value)
  })

  it('page-max-web = 1200px, page-pad-app = 20px', () => {
    expect(propValue(root, '--page-max-web')).toBe('1200px')
    expect(propValue(root, '--page-pad-app')).toBe('20px')
  })

  it('bridge aliases --radius-card/-input', () => {
    expect(propValue(root, '--radius-card')).toBe('var(--radius-lg)')
    expect(propValue(root, '--radius-input')).toBe('var(--radius-sm)')
  })

  it('no [data-theme="dark"] block in spacing.css', () => {
    expect(spacingCss).not.toMatch(/\[data-theme=["']dark["']\]/)
  })
})
