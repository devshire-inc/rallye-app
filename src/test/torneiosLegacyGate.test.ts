import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** BEAC-2118 (última task de domínio de BEAC-1663): prova, pro repositório
 * INTEIRO — não só o domínio de Torneios desta story — que a ponte de
 * compatibilidade legada pode ser removida. Escopo travado pela spec
 * (doc Allye 1ec44ce1, decisão BEAC-2063): varre todo `src/**\/*.{css,ts,tsx}`,
 * exceto `src/styles/tokens` (onde os aliases são legitimamente DEFINIDOS,
 * não consumidos). Reaproveita a lista de 28 aliases e o padrão de regex de
 * src/components/ui/legacyGate.test.ts, mas com escopo de varredura
 * repositório-wide em vez de um único diretório de domínio. */
const SRC_DIR = 'src'
const EXCLUDED_DIRS = ['src/styles/tokens']

/** Os 28 aliases da ponte de compatibilidade legada definidos em BEAC-1734 (23 em
 * colors.css + 3 em effects.css + 2 em spacing.css, conferido lendo os 3 arquivos
 * na íntegra) — nenhum arquivo do projeto (fora de src/styles/tokens, onde são
 * legitimamente definidos) pode consumi-los; devem usar os tokens semânticos
 * reais (mesma lista de src/components/ui/legacyGate.test.ts, escopo diferente). */
const LEGACY_ALIASES = [
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

function collectScannedFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (EXCLUDED_DIRS.includes(fullPath)) continue
    if (entry.isDirectory()) {
      files.push(...collectScannedFiles(fullPath))
      continue
    }
    if (!/\.(css|ts|tsx)$/.test(entry.name)) continue
    files.push(fullPath)
  }
  return files
}

const SCANNED_FILES = collectScannedFiles(SRC_DIR)

describe('project-wide legacy gate — scan sanity', () => {
  it('scans the whole src/ tree, excluding only src/styles/tokens', () => {
    expect(SCANNED_FILES.length).toBeGreaterThan(300)
    expect(SCANNED_FILES.some((file) => file.startsWith('src/styles/tokens'))).toBe(false)
    // Confirma que arquivos de fora do domínio de Torneios (outros domínios já
    // migrados por stories anteriores) e os próprios arquivos de teste/gate
    // estão dentro do escopo varrido — nenhuma exclusão além de styles/tokens.
    expect(SCANNED_FILES.some((file) => file.startsWith('src/pages/Financeiro'))).toBe(true)
    expect(SCANNED_FILES.some((file) => file.startsWith('src/pages/Turmas'))).toBe(true)
    expect(SCANNED_FILES.some((file) => file === 'src/components/ui/legacyGate.test.ts')).toBe(true)
    expect(SCANNED_FILES.some((file) => file === 'src/test/torneiosLegacyGate.test.ts')).toBe(true)
  })
})

describe('project-wide legacy gate — the 28 legacy bridge aliases', () => {
  for (const alias of LEGACY_ALIASES) {
    it(`--${alias} is not consumed via var(--${alias}) anywhere outside src/styles/tokens`, () => {
      const pattern = new RegExp(`var\\(--${alias}\\)`)
      const offenders = SCANNED_FILES.filter((file) => pattern.test(readFileSync(file, 'utf8')))
      expect(offenders, `files still consuming var(--${alias})`).toEqual([])
    })
  }
})

describe('project-wide legacy gate — detection actually has teeth (synthetic fixtures, not real files)', () => {
  it('would catch a legacy alias if one existed', () => {
    const alias = LEGACY_ALIASES[0]!
    expect(`color: var(--${alias});`).toMatch(new RegExp(`var\\(--${alias}\\)`))
  })

  it('does not flag a real semantic token that merely shares a prefix with a legacy alias', () => {
    // --border-default shares the prefix "border" with the legacy --border alias, but
    // the closing ")" in var(--alias) only matches right after the alias name ends —
    // "-default)" breaks that, so this is never a false positive.
    for (const alias of LEGACY_ALIASES) {
      expect(`var(--${alias}-default)`).not.toMatch(new RegExp(`var\\(--${alias}\\)`))
    }
  })

  it('does not flag this file or its sibling gate for merely naming the aliases as strings', () => {
    // Both gates hold the 28 names as plain string literals (for the LEGACY_ALIASES
    // array and error messages) and only ever build `var(--x)` through template
    // interpolation (`` `var(--${alias})` ``) — never as hardcoded literal text — so
    // scanning their own source can never self-trigger a false positive.
    const ownSource = readFileSync('src/test/torneiosLegacyGate.test.ts', 'utf8')
    const uiGateSource = readFileSync('src/components/ui/legacyGate.test.ts', 'utf8')
    for (const alias of LEGACY_ALIASES) {
      const pattern = new RegExp(`var\\(--${alias}\\)`)
      expect(ownSource, `self-triggered on --${alias}`).not.toMatch(pattern)
      expect(uiGateSource, `triggered by ui gate on --${alias}`).not.toMatch(pattern)
    }
  })
})
