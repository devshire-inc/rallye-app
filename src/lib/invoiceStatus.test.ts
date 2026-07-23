import { describe, expect, it } from 'vitest'
import { daysUntilDue, isPending, statusBadgeClass } from './invoiceStatus'

describe('statusBadgeClass', () => {
  it('paga -> success', () => {
    expect(statusBadgeClass('paga')).toBe('badge b-success')
  })
  it('atrasada -> error', () => {
    expect(statusBadgeClass('atrasada')).toBe('badge b-error')
  })
  it('enviada -> warning', () => {
    expect(statusBadgeClass('enviada')).toBe('badge b-warning')
  })
  it('gerada -> neutral', () => {
    expect(statusBadgeClass('gerada')).toBe('badge b-neutral')
  })
  it('cancelada -> neutral', () => {
    expect(statusBadgeClass('cancelada')).toBe('badge b-neutral')
  })
  it('estornada -> info', () => {
    expect(statusBadgeClass('estornada')).toBe('badge b-info')
  })
})

describe('isPending', () => {
  it('gerada e enviada são pendentes', () => {
    expect(isPending('gerada')).toBe(true)
    expect(isPending('enviada')).toBe(true)
  })
  it('atrasada/paga/cancelada/estornada não são pendentes', () => {
    expect(isPending('atrasada')).toBe(false)
    expect(isPending('paga')).toBe(false)
    expect(isPending('cancelada')).toBe(false)
    expect(isPending('estornada')).toBe(false)
  })
})

describe('daysUntilDue', () => {
  const today = new Date(Date.UTC(2026, 6, 22)) // 22/07/2026

  it('vencimento futuro devolve positivo', () => {
    expect(daysUntilDue('2026-07-25', today)).toBe(3)
  })
  it('vencimento hoje devolve zero', () => {
    expect(daysUntilDue('2026-07-22', today)).toBe(0)
  })
  it('vencimento passado devolve negativo', () => {
    expect(daysUntilDue('2026-06-10', today)).toBe(-42)
  })
})
