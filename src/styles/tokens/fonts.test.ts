import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('fonts.css — exact @fontsource weight imports', () => {
  const fontsCss = readFileSync('src/styles/tokens/fonts.css', 'utf8')

  const expectedImports = [
    "@import '@fontsource/baloo-2/700.css'",
    "@import '@fontsource/baloo-2/800.css'",
    "@import '@fontsource/nunito/400.css'",
    "@import '@fontsource/nunito/700.css'",
    "@import '@fontsource/nunito/800.css'",
    "@import '@fontsource/spline-sans-mono/600.css'",
  ]

  it.each(expectedImports)('contains %s', (line) => {
    expect(fontsCss).toContain(line)
  })

  it('contains exactly 6 @import statements', () => {
    const matches = fontsCss.match(/@import\s+/g) ?? []
    expect(matches).toHaveLength(6)
  })

  it('does not import spline-sans-mono/800.css (not published by the package)', () => {
    expect(fontsCss).not.toContain('spline-sans-mono/800.css')
  })

  it('never references fonts.googleapis.com', () => {
    expect(fontsCss).not.toContain('fonts.googleapis.com')
  })
})

describe('fonts.css — no CDN dependency anywhere in the project', () => {
  it('src/index.css does not reference fonts.googleapis.com', () => {
    const indexCss = readFileSync('src/index.css', 'utf8')
    expect(indexCss).not.toContain('fonts.googleapis.com')
  })
})

describe('@fontsource packages actually resolve (fails the build if missing)', () => {
  it('baloo-2 700/800 resolve', async () => {
    await import('@fontsource/baloo-2/700.css')
    await import('@fontsource/baloo-2/800.css')
  })

  it('nunito 400/700/800 resolve', async () => {
    await import('@fontsource/nunito/400.css')
    await import('@fontsource/nunito/700.css')
    await import('@fontsource/nunito/800.css')
  })

  it('spline-sans-mono 600 resolves', async () => {
    await import('@fontsource/spline-sans-mono/600.css')
  })
})
