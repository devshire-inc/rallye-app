import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const TOKENS_PATH = 'src/styles/tokens/colors.css'

function extractBlock(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : null
}

function rawValue(block: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`(?:^|[\\s;{])${escaped}\\s*:\\s*([^;]+);`))
  return match ? match[1].trim() : null
}

/** Resolve a custom property to a literal `RRGGBB` hex string, following
 * `var(--x)` chains (dark theme falls back to the `:root` value for any
 * property it doesn't redefine, same as real CSS cascade). Never hand-copies
 * hex values — always reads them from the real file. */
function resolveHex(propName: string, lightBlock: string, darkBlock: string | null): string {
  function resolve(name: string, seen: Set<string>): string {
    if (seen.has(name)) throw new Error(`circular reference resolving ${name}`)
    seen.add(name)

    const value = (darkBlock ? rawValue(darkBlock, name) : null) ?? rawValue(lightBlock, name)
    if (value === null) throw new Error(`token ${name} not found`)

    const varMatch = value.match(/^var\(\s*(--[\w-]+)/)
    if (varMatch) return resolve(varMatch[1], seen)

    const hexMatch = value.match(/^#([0-9a-fA-F]{6})$/)
    if (hexMatch) return hexMatch[1].toUpperCase()

    throw new Error(`token ${name} resolves to a non-hex value: "${value}" — cannot compute contrast`)
  }

  return resolve(propName, new Set())
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

type Theme = 'light' | 'dark'
type PairKind = 'text' | 'ui'

interface TokenPair {
  surface: string
  foreground: string
  kind: PairKind
}

const TEXT_MIN_RATIO = 4.5
const UI_MIN_RATIO = 3

// Real, confirmed WCAG AA failures in the current colors.css (BEAC-1734/1661
// — a different, already-merged story; not touched here). Documented via
// it.fails() rather than skipped/weakened: bun run test (and CI, which runs
// the same "vitest run" with no tolerance flag) stays green while the defect
// remains visible and tracked. If a future fix to colors.css makes one of
// these pairs meet its ratio, it.fails() itself starts failing — forcing
// whoever lands that fix to notice and convert the case back to a normal
// passing assertion.
interface KnownFailingPair {
  theme: Theme
  foreground: string
  surface: string
}

const KNOWN_FAILING: KnownFailingPair[] = [
  { theme: 'light', foreground: '--text-on-brand', surface: '--surface-brand' },
  { theme: 'dark', foreground: '--text-on-brand', surface: '--surface-brand' },
  { theme: 'light', foreground: '--text-muted', surface: '--surface-sunken' },
]

function isKnownFailing(theme: Theme, pair: TokenPair): boolean {
  return KNOWN_FAILING.some(
    (k) => k.theme === theme && k.foreground === pair.foreground && k.surface === pair.surface,
  )
}

// The 9 pairs named in BEAC-2085's AC. Text pairs (foreground renders actual
// copy) need 4.5:1; UI-indicator pairs (solid color over its own soft
// background, with no text overlaid) need 3:1. --state-warning uses
// --state-warning-text (the real text token painted over --state-warning-soft)
// per the AC's own note, instead of the solid --state-warning swatch.
const PAIRS: TokenPair[] = [
  { surface: '--surface-page', foreground: '--text-body', kind: 'text' },
  { surface: '--surface-card', foreground: '--text-body', kind: 'text' },
  { surface: '--surface-card', foreground: '--text-heading', kind: 'text' },
  { surface: '--surface-brand', foreground: '--text-on-brand', kind: 'text' },
  { surface: '--surface-sunken', foreground: '--text-muted', kind: 'text' },
  { surface: '--state-success-soft', foreground: '--state-success', kind: 'ui' },
  { surface: '--state-warning-soft', foreground: '--state-warning-text', kind: 'ui' },
  { surface: '--state-danger-soft', foreground: '--state-danger', kind: 'ui' },
  { surface: '--state-info-soft', foreground: '--state-info', kind: 'ui' },
]

const colorsCss = readFileSync(TOKENS_PATH, 'utf8')
const lightBlock = extractBlock(colorsCss, ':root')
const darkBlock = extractBlock(colorsCss, '[data-theme="dark"]')

if (!lightBlock) throw new Error(`:root block not found in ${TOKENS_PATH}`)

const THEMES: Theme[] = ['light', 'dark']

describe('token contrast — WCAG AA (BEAC-2085)', () => {
  it.each(THEMES)('%s theme resolves all 9 token pairs to real ratios', (theme) => {
    for (const pair of PAIRS) {
      const block = theme === 'dark' ? darkBlock : null
      const surfaceHex = resolveHex(pair.surface, lightBlock, block)
      const foregroundHex = resolveHex(pair.foreground, lightBlock, block)
      expect(contrastRatio(surfaceHex, foregroundHex)).toBeGreaterThan(0)
    }
  })

  describe.each(THEMES)('%s theme', (theme) => {
    const checkPair = (pair: TokenPair) => {
      const block = theme === 'dark' ? darkBlock : null
      const surfaceHex = resolveHex(pair.surface, lightBlock, block)
      const foregroundHex = resolveHex(pair.foreground, lightBlock, block)
      const ratio = contrastRatio(surfaceHex, foregroundHex)
      const minRatio = pair.kind === 'text' ? TEXT_MIN_RATIO : UI_MIN_RATIO

      expect(
        ratio,
        `${pair.foreground} on ${pair.surface} in ${theme} theme: ${ratio.toFixed(2)}:1, ` +
          `below the required ${minRatio}:1 for a ${pair.kind === 'text' ? 'text' : 'UI-indicator'} pair`,
      ).toBeGreaterThanOrEqual(minRatio)
    }

    const passingPairs = PAIRS.filter((pair) => !isKnownFailing(theme, pair))
    const failingPairs = PAIRS.filter((pair) => isKnownFailing(theme, pair))

    it.each(passingPairs.map((pair) => [pair.foreground, pair.surface, pair.kind, pair] as const))(
      '%s on %s (%s) meets its WCAG AA minimum',
      (_foreground, _surface, _kind, pair) => checkPair(pair),
    )

    for (const pair of failingPairs) {
      it.fails(
        `${pair.foreground} on ${pair.surface} (${pair.kind}) meets its WCAG AA minimum ` +
          `— KNOWN FAILING, colors.css defect out of scope (BEAC-2085 correction 1)`,
        () => checkPair(pair),
      )
    }
  })
})
