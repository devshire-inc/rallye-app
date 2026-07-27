import { describe, expect, it } from 'vitest'
import { SPORTS, sportCssVar, sportLabel } from './sports'

describe('SPORTS catalog', () => {
  it('preserves the 4 existing entries', () => {
    expect(SPORTS.find((s) => s.slug === 'beach_tennis')).toEqual({
      slug: 'beach_tennis',
      label: 'Beach tennis',
      cssVar: '--sport-beach-tennis',
    })
    expect(SPORTS.find((s) => s.slug === 'padel')).toEqual({
      slug: 'padel',
      label: 'Padel',
      cssVar: '--sport-padel',
    })
    expect(SPORTS.find((s) => s.slug === 'futevolei')).toEqual({
      slug: 'futevolei',
      label: 'Futevôlei',
      cssVar: '--sport-futevolei',
    })
    expect(SPORTS.find((s) => s.slug === 'volei')).toEqual({
      slug: 'volei',
      label: 'Vôlei',
      cssVar: '--sport-volei',
    })
  })

  it('gains tenis and outro', () => {
    expect(SPORTS.find((s) => s.slug === 'tenis')).toEqual({
      slug: 'tenis',
      label: 'Tênis',
      cssVar: '--sport-tenis',
    })
    expect(SPORTS.find((s) => s.slug === 'outro')).toEqual({
      slug: 'outro',
      label: 'Outro',
      cssVar: '--sport-outro',
    })
  })
})

describe('sportLabel', () => {
  it.each([
    ['beach_tennis', 'Beach tennis'],
    ['padel', 'Padel'],
    ['futevolei', 'Futevôlei'],
    ['volei', 'Vôlei'],
    ['tenis', 'Tênis'],
    ['outro', 'Outro'],
  ])('%s -> %s', (slug, label) => {
    expect(sportLabel(slug)).toBe(label)
  })

  it('falls back to the slug itself for unknown sports', () => {
    expect(sportLabel('esporte-desconhecido')).toBe('esporte-desconhecido')
  })
})

describe('sportCssVar', () => {
  it.each([
    ['beach_tennis', '--sport-beach-tennis'],
    ['padel', '--sport-padel'],
    ['futevolei', '--sport-futevolei'],
    ['volei', '--sport-volei'],
    ['tenis', '--sport-tenis'],
    ['outro', '--sport-outro'],
  ])('%s -> %s', (slug, cssVar) => {
    expect(sportCssVar(slug)).toBe(cssVar)
  })

  it('falls back to the canonical --border-default token for unknown sports, never the legacy --border alias', () => {
    expect(sportCssVar('esporte-desconhecido')).toBe('--border-default')
    expect(sportCssVar('esporte-desconhecido')).not.toBe('--border')
  })
})
