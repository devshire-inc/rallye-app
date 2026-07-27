import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_DIR = 'src/components/ui'
const GATE_FILES = ['inventory.test.ts', 'legacyGate.test.ts']

/** Os 28 aliases da ponte de compatibilidade legada definidos em BEAC-1734 (23 em
 * colors.css + 3 em effects.css + 2 em spacing.css) — nenhum arquivo de produção
 * desta biblioteca pode consumi-los; devem usar os tokens semânticos reais. */
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

function collectProductionFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectProductionFiles(fullPath))
      continue
    }
    if (!/\.(css|tsx)$/.test(entry.name)) continue
    if (/\.test\.tsx?$/.test(entry.name)) continue
    if (GATE_FILES.includes(entry.name)) continue
    files.push(fullPath)
  }
  return files
}

const PRODUCTION_FILES = collectProductionFiles(UI_DIR)
const PRODUCTION_TSX_FILES = PRODUCTION_FILES.filter((file) => file.endsWith('.tsx'))

/** Extrai os blocos de objeto usados como `style` dinâmico — tanto inline
 * (`style={{...}}`, com ou sem `as CSSProperties`) quanto via variável
 * (`const x = {...} as CSSProperties`). Baseado em regex (não um parser de AST);
 * suficiente para o único padrão usado nesta biblioteca: objetos de uma linha
 * de profundidade, sem chaves aninhadas dentro do próprio objeto de estilo. */
function extractDynamicStyleBlocks(source: string): string[] {
  const blocks: string[] = []

  // [^{}]* (not [\s\S]*?) is deliberate: it stops at the object literal's OWN
  // closing brace and can never skip past it to match a LATER, unrelated
  // "as CSSProperties" elsewhere in the file — which a non-greedy [\s\S]*?
  // would do whenever an earlier, unrelated `= {...} as const` map (e.g.
  // ClassCard's STATUS_TONE) sits between two real style declarations. Safe
  // here because no style object in this library nests another object/array.
  const combinedInline = /style=\{\{([^{}]*)\}\s*as\s*CSSProperties\s*\}/g
  const typedVariable = /=\s*\{([^{}]*)\}\s*as\s*CSSProperties/g
  for (const re of [combinedInline, typedVariable]) {
    let match: RegExpExecArray | null
    while ((match = re.exec(source))) blocks.push(match[1]!)
  }

  const plainInline = /style=\{\{([^{}]*)\}\}/g
  let match: RegExpExecArray | null
  while ((match = plainInline.exec(source))) {
    if (!/as\s*CSSProperties/.test(match[0])) blocks.push(match[1]!)
  }

  return blocks
}

function literalKeysIn(block: string): string[] {
  const keyRe = /(['"]?)([\w-]+)\1\s*:/g
  const literalKeys: string[] = []
  let match: RegExpExecArray | null
  while ((match = keyRe.exec(block))) {
    const key = match[2]!
    if (!key.startsWith('--')) literalKeys.push(key)
  }
  return literalKeys
}

describe('legacy gate — production files only', () => {
  it('excludes test files and its own gate files from the scan', () => {
    expect(PRODUCTION_FILES.some((file) => file.endsWith('.test.tsx'))).toBe(false)
    expect(PRODUCTION_FILES.some((file) => file.endsWith('.test.ts'))).toBe(false)
    expect(PRODUCTION_FILES.some((file) => file.endsWith('inventory.test.ts'))).toBe(false)
    expect(PRODUCTION_FILES.some((file) => file.endsWith('legacyGate.test.ts'))).toBe(false)
  })

  it('scans every production .css/.tsx file, including the two typecheck files', () => {
    expect(PRODUCTION_FILES.length).toBeGreaterThan(30)
    expect(PRODUCTION_FILES.some((file) => file.endsWith('core.typecheck.tsx'))).toBe(true)
    expect(PRODUCTION_FILES.some((file) => file.endsWith('forms.typecheck.tsx'))).toBe(true)
  })
})

describe.each(PRODUCTION_FILES)('legacy gate — %s', (file) => {
  const source = readFileSync(file, 'utf8')

  it('has no hex color literal', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('does not consume any of the 28 legacy bridge aliases', () => {
    for (const alias of LEGACY_ALIASES) {
      expect(source, `uses legacy alias --${alias}`).not.toMatch(new RegExp(`var\\(--${alias}\\)`))
    }
  })
})

describe.each(PRODUCTION_TSX_FILES)('legacy gate — inline style literals — %s', (file) => {
  const source = readFileSync(file, 'utf8')

  it('uses only custom properties (--*) in dynamic style objects', () => {
    const blocks = extractDynamicStyleBlocks(source)
    for (const block of blocks) {
      const literalKeys = literalKeysIn(block)
      expect(literalKeys, `literal CSS propert(y/ies) found: ${literalKeys.join(', ')}`).toEqual([])
    }
  })
})

describe('legacy gate — detection actually has teeth (synthetic fixtures, not real files)', () => {
  it('flags a literal CSS property in an inline style={{...}} block', () => {
    const source = `function X() { return <div style={{ color: 'red' }} /> }`
    const blocks = extractDynamicStyleBlocks(source)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some((block) => literalKeysIn(block).includes('color'))).toBe(true)
  })

  it('flags a literal CSS property in a variable cast as CSSProperties', () => {
    const source = `const style = { display: 'none' } as CSSProperties`
    const blocks = extractDynamicStyleBlocks(source)
    expect(blocks.some((block) => literalKeysIn(block).includes('display'))).toBe(true)
  })

  it('does not cross into an unrelated "as const" map that sits before the real style object', () => {
    const source = `
      const STATUS_TONE = { confirmada: 'success', pendente: 'warning' } as const
      const style = { '--accent': 'var(--interactive-primary)' } as CSSProperties
    `
    const blocks = extractDynamicStyleBlocks(source)
    const allKeys = blocks.flatMap((block) => literalKeysIn(block))
    expect(allKeys).toEqual([])
  })

  it('does not flag a custom property key', () => {
    expect(literalKeysIn("'--tag-color': 'var(--sport-padel)'")).toEqual([])
  })

  it('would catch a hex literal if one existed', () => {
    expect('background: #FFFFFF;').toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('would catch a legacy alias if one existed', () => {
    const alias = LEGACY_ALIASES[0]!
    expect(`color: var(--${alias});`).toMatch(new RegExp(`var\\(--${alias}\\)`))
  })
})
