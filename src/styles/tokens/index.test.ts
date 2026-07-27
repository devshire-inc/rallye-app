import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('src/styles/tokens/index.css — aggregator import order', () => {
  const css = readFileSync('src/styles/tokens/index.css', 'utf8')
  const importLines = css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  it('imports exactly the 5 Wave 1 files, in order', () => {
    expect(importLines).toEqual([
      "@import './fonts.css';",
      "@import './colors.css';",
      "@import './effects.css';",
      "@import './typography.css';",
      "@import './spacing.css';",
    ])
  })
})

describe('src/index.css — rewritten entrypoint', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const firstNonEmptyLine = css
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  const LEGACY_HEX = ['#e8703f', '#d7f235', '#0d2233', '#f2f7fa']
  const BRIDGE_ALIASES = [
    'bg',
    'surface',
    'border',
    'text-primary',
    'accent',
    'on-accent',
    'sand',
    'teal',
    'sky',
    'sky-text',
    'sky-muted',
    'hz-top',
    'hz-bot',
    'success-bg',
    'success-fg',
    'warning-bg',
    'warning-fg',
    'error-bg',
    'error-fg',
    'data',
    'data-soft',
    'link',
    'scrim',
    'ease-enter',
    'motion-fast',
    'motion-slow',
    'radius-card',
    'radius-input',
  ]

  it('first non-empty line is the tokens aggregator import', () => {
    expect(firstNonEmptyLine).toBe("@import './styles/tokens/index.css';")
  })

  it('contains no leftover Saque Noturno literal hex values', () => {
    for (const hex of LEGACY_HEX) {
      expect(css.toLowerCase()).not.toContain(hex)
    }
  })

  it('contains no @font-face and no prefers-color-scheme media query', () => {
    expect(css).not.toMatch(/@font-face/)
    expect(css).not.toMatch(/@media\s*\(\s*prefers-color-scheme/)
  })

  it('does not consume any of the 28 legacy bridge aliases via var(--name)', () => {
    for (const alias of BRIDGE_ALIASES) {
      expect(css).not.toMatch(new RegExp(`var\\(--${alias}\\)`))
    }
  })

  it('h1 uses --type-title, h2 uses --type-heading', () => {
    expect(css).toMatch(/h1\s*\{\s*font:\s*var\(--type-title\);?\s*\}/)
    expect(css).toMatch(/h2\s*\{\s*font:\s*var\(--type-heading\);?\s*\}/)
  })

  it('focus-visible uses box-shadow, not outline color, for the new --focus-ring', () => {
    const block = css.match(/:focus-visible\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block![1]).toMatch(/outline:\s*none/)
    expect(block![1]).toMatch(/box-shadow:\s*var\(--focus-ring\)/)
  })

  it('anchor color uses --interactive-primary directly, not the --link alias', () => {
    const block = css.match(/(?<!:hover\s*)\ba\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block![1]).toMatch(/color:\s*var\(--interactive-primary\)/)
  })
})
