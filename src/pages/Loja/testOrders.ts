import type { StoreOrder } from '../../lib/api/store'

/** Pedido #0042 do frame 26 (R$ 447,00, Beira-Mar, duas linhas), compartilhado
 * pelos testes das telas 25/26/27 para os três falarem do mesmo pedido. */
export function order(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: 'order-1',
    orderNumber: 42,
    numberLabel: '#0042',
    unitId: 'unit-1',
    unitName: 'Arena Beira-Mar',
    status: 'aguardando_pagamento',
    fulfillmentStatus: 'preparando',
    invoiceId: 'invoice-1',
    invoiceStatus: 'gerada',
    total: 447,
    itemCount: 2,
    items: [
      {
        id: 'oi-1',
        variantId: 'var-1',
        productName: 'Raquete Shark Pro',
        variantLabel: 'Preto · 340g',
        unitPrice: 389,
        quantity: 1,
        lineTotal: 389,
      },
      {
        id: 'oi-2',
        variantId: 'var-2',
        productName: 'Overgrip Pack x3',
        variantLabel: '',
        unitPrice: 29,
        quantity: 2,
        lineTotal: 58,
      },
    ],
    pickup: {
      unitName: 'Arena Beira-Mar',
      address: 'Av. Beira-Mar, 1200',
      city: 'Recife',
      state: 'PE',
    },
    createdAt: '2026-03-24T12:00:00Z',
    readyAt: null,
    deliveredAt: null,
    cancelledAt: null,
    ...overrides,
  }
}
