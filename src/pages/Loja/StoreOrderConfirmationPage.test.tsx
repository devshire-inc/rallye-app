import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import StoreOrderConfirmationPage from './StoreOrderConfirmationPage'
import { pickupAddressLabel } from './orders'
import { order } from './testOrders'

vi.mock('../../hooks/usePermission', () => ({ usePermission: () => false }))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  navigate.mockReset()
  return renderWithQuery(
    <MemoryRouter initialEntries={['/store/orders/order-1']}>
      <Routes>
        <Route path="/store/orders/:orderId" element={<StoreOrderConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StoreOrderConfirmationPage — tela 26', () => {
  it('mostra número, itens, total e o endereço de retirada do pedido', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({ ok: true, order: order() })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Pedido confirmado!' })).toBeInTheDocument()
    expect(screen.getByText('Pedido #0042')).toBeInTheDocument()
    expect(screen.getByText(/Raquete Shark Pro · Preto · 340g ×1/)).toBeInTheDocument()
    expect(screen.getByText(/Total: R\$\s*447,00/)).toBeInTheDocument()
    // O endereço vem do pedido — é aqui que ele passa a existir.
    expect(screen.getByText('Av. Beira-Mar, 1200 — Recife/PE')).toBeInTheDocument()
  })

  it('manda o pagamento para a tela de PIX da FATURA, sem duplicar cobrança', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({ ok: true, order: order() })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'PAGAR COM PIX' }))

    expect(navigate).toHaveBeenCalledWith('/invoices/invoice-1/pix')
  })

  it('some com o CTA de pagamento quando o status derivado já saiu de aguardando', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({
      ok: true,
      order: order({ status: 'preparando', invoiceStatus: 'paga' }),
    })

    renderPage()

    expect(await screen.findByText('Preparando')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'PAGAR COM PIX' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'VER MEUS PEDIDOS' })).toBeInTheDocument()
  })

  it('mostra o status derivado, não o fulfillment cru', async () => {
    /* O pedido está "preparando" na coluna, mas a fatura não foi paga — o que
       o usuário precisa ver é que falta pagar. */
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({
      ok: true,
      order: order({ status: 'aguardando_pagamento', fulfillmentStatus: 'preparando' }),
    })

    renderPage()

    expect(await screen.findByText('Aguardando pagamento')).toBeInTheDocument()
    expect(screen.queryByText('Preparando')).not.toBeInTheDocument()
  })

  it('não desenha "COMO CHEGAR" — não há mapa nem geolocalização no backend', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({ ok: true, order: order() })

    renderPage()

    await screen.findByRole('heading', { name: 'Pedido confirmado!' })
    expect(screen.queryByText(/COMO CHEGAR/)).not.toBeInTheDocument()
  })

  it('"continuar comprando" volta ao catálogo da arena DO PEDIDO', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({
      ok: true,
      order: order({ unitId: 'unit-2' }),
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'CONTINUAR COMPRANDO' }))

    expect(navigate).toHaveBeenCalledWith('/units/unit-2/store')
  })

  it('trata o 404 de pedido alheio como "não encontrado", não como falha', async () => {
    vi.spyOn(storeApi, 'getStoreOrder').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'order_not_found',
    })

    renderPage()

    expect(await screen.findByText('Pedido não encontrado')).toBeInTheDocument()
  })
})

describe('pickupAddressLabel', () => {
  it('monta "endereço — Cidade/UF"', () => {
    expect(
      pickupAddressLabel({
        unitName: 'Arena Beira-Mar',
        address: 'Av. Beira-Mar, 1200',
        city: 'Recife',
        state: 'PE',
      }),
    ).toBe('Av. Beira-Mar, 1200 — Recife/PE')
  })

  it('não deixa traço nem barra órfãos com cadastro incompleto', () => {
    expect(
      pickupAddressLabel({ unitName: 'X', address: 'Av. Beira-Mar, 1200', city: '', state: '' }),
    ).toBe('Av. Beira-Mar, 1200')
    expect(pickupAddressLabel({ unitName: 'X', address: '', city: 'Recife', state: '' })).toBe(
      'Recife',
    )
    expect(pickupAddressLabel({ unitName: 'X', address: '', city: '', state: '' })).toBeNull()
  })
})
