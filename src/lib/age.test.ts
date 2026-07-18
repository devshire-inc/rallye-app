import { describe, expect, it } from 'vitest'
import { isMinor } from './age'

describe('isMinor', () => {
  const now = new Date('2026-07-18T12:00:00Z')

  it('17 anos -> menor', () => {
    expect(isMinor('2009-07-19', now)).toBe(true)
  })

  it('exatamente 18 anos hoje -> maior', () => {
    expect(isMinor('2008-07-18', now)).toBe(false)
  })

  it('18 anos completos ontem -> maior', () => {
    expect(isMinor('2008-07-17', now)).toBe(false)
  })

  it('1 dia antes de completar 18 -> menor', () => {
    expect(isMinor('2008-07-19', now)).toBe(true)
  })

  it('adulto de 40 anos -> maior', () => {
    expect(isMinor('1986-01-01', now)).toBe(false)
  })

  it('data inválida -> maior (fail-safe, não bloqueia o formulário por um parse ruim)', () => {
    expect(isMinor('not-a-date', now)).toBe(false)
  })
})
