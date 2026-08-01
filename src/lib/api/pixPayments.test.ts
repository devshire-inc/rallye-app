import { describe, expect, it } from 'vitest'
import {
  isMockProvider,
  isPixConfirmed,
  isPixExpired,
  isPixPending,
  type PixPayment,
} from './pixPayments'

const NOW = Date.parse('2026-08-01T12:00:00Z')

function payment(overrides: Partial<PixPayment> = {}): PixPayment {
  return {
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    status: 'pending',
    amount: 315,
    method: 'pix',
    provider: 'mock',
    mock: true,
    qrCode: 'MOCK-PIX-SEM-GATEWAY|RALLYE|BRL31500|NAO-PAGAVEL',
    expiresAt: '2026-08-01T12:30:00Z',
    createdAt: '2026-08-01T12:00:00Z',
    confirmedAt: null,
    invoiceStatus: 'gerada',
    ...overrides,
  }
}

describe('classificação de estado da cobrança PIX', () => {
  it('trata como confirmado quando confirmed_at chegou, sem depender do literal de status', () => {
    /* O ponto do helper: o backend documenta 'pending'/'expired', mas não
       garante qual literal usa no estado terminal de sucesso. Aqui o status
       segue 'pending' de propósito. */
    const confirmed = payment({ confirmedAt: '2026-08-01T12:10:00Z' })

    expect(isPixConfirmed(confirmed)).toBe(true)
    expect(isPixPending(confirmed, NOW)).toBe(false)
  })

  it('trata como confirmado quando a fatura veio paga no mesmo payload', () => {
    expect(isPixConfirmed(payment({ invoiceStatus: 'paga' }))).toBe(true)
  })

  it('não considera expirada uma cobrança já confirmada, mesmo com prazo vencido', () => {
    const paid = payment({
      confirmedAt: '2026-08-01T12:10:00Z',
      expiresAt: '2026-08-01T11:00:00Z',
    })

    expect(isPixExpired(paid, NOW)).toBe(false)
  })

  it('antecipa a expiração pelo relógio do cliente antes do backend marcar', () => {
    const overdue = payment({ status: 'pending', expiresAt: '2026-08-01T11:59:00Z' })

    expect(isPixExpired(overdue, NOW)).toBe(true)
    expect(isPixPending(overdue, NOW)).toBe(false)
  })

  it('respeita o status expired do backend mesmo sem prazo no payload', () => {
    expect(isPixExpired(payment({ status: 'expired', expiresAt: null }), NOW)).toBe(true)
  })

  it('mantém pendente enquanto o prazo não venceu', () => {
    expect(isPixPending(payment(), NOW)).toBe(true)
  })

  it('não expira quando não há prazo conhecido', () => {
    expect(isPixExpired(payment({ expiresAt: null }), NOW)).toBe(false)
  })

  it('reconhece o provider mock por qualquer um dos dois sinais', () => {
    expect(isMockProvider(payment({ mock: true, provider: 'outro' }))).toBe(true)
    expect(isMockProvider(payment({ mock: false, provider: 'mock' }))).toBe(true)
    expect(isMockProvider(payment({ mock: false, provider: 'gateway-real' }))).toBe(false)
  })
})
