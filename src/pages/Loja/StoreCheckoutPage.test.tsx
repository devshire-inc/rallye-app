import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import type { Cart } from '../../lib/api/store'
import StoreCheckoutPage from './StoreCheckoutPage'
import { order } from './testOrders'

vi.mock('../../hooks/usePermission', () => ({ usePermission: () => false }))

afterEach(() => {
  vi.restoreAllMocks()
})

/** O carrinho do frame 24: duas arenas, R$ 536,00 no total — dos quais só os
 * R$ 447,00 da Beira-Mar entram NESTE checkout. */
function twoArenaCart(overrides: Partial<Cart> = {}): Cart {
  return {
    groups: [
      {
        unitId: 'unit-1',
        unitName: 'Arena Beira-Mar',
        items: [
          {
            id: 'item-1',
            variantId: 'var-1',
            productId: 'prod-1',
            productName: 'Raquete Shark Pro',
            variantLabel: 'Preto · 340g',
            imageUrl: null,
            unitPrice: 389,
            quantity: 1,
            lineTotal: 389,
            stockQuantity: 8,
            available: true,
          },
          {
            id: 'item-2',
            variantId: 'var-2',
            productId: 'prod-2',
            productName: 'Overgrip Pack x3',
            variantLabel: '',
            imageUrl: null,
            unitPrice: 29,
            quantity: 2,
            lineTotal: 58,
            stockQuantity: 20,
            available: true,
          },
        ],
        subtotal: 447,
        checkoutable: true,
      },
      {
        unitId: 'unit-2',
        unitName: 'Beach Master Barra',
        items: [
          {
            id: 'item-3',
            variantId: 'var-3',
            productId: 'prod-3',
            productName: 'Viseira Nike',
            variantLabel: '',
            imageUrl: null,
            unitPrice: 89,
            quantity: 1,
            lineTotal: 89,
            stockQuantity: 4,
            available: true,
          },
        ],
        subtotal: 89,
        checkoutable: true,
      },
    ],
    itemCount: 3,
    unitCount: 2,
    total: 536,
    ...overrides,
  }
}

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage(unitId = 'unit-1') {
  navigate.mockReset()
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/store/checkout/${unitId}`]}>
      <Routes>
        <Route path="/store/checkout/:unitId" element={<StoreCheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StoreCheckoutPage — um checkout fecha UMA arena', () => {
  it('resume só o grupo da arena da rota, não o carrinho inteiro', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Resumo do Pedido' })).toBeInTheDocument()
    expect(screen.getByText(/Raquete Shark Pro/)).toBeInTheDocument()
    expect(screen.queryByText(/Viseira Nike/)).not.toBeInTheDocument()
    // R$ 447,00 (Beira-Mar) e nunca R$ 536,00 (carrinho inteiro).
    expect(screen.queryByText(/536,00/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CONFIRMAR — R\$\s*447,00/ })).toBeEnabled()
  })

  it('fecha o pedido mandando só a arena e vai para a confirmação, substituindo o histórico', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })
    const create = vi
      .spyOn(storeApi, 'createStoreOrder')
      .mockResolvedValue({ ok: true, order: order() })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /CONFIRMAR/ }))

    await waitFor(() => expect(create).toHaveBeenCalledWith('unit-1'))
    expect(navigate).toHaveBeenCalledWith('/store/orders/order-1', { replace: true })
  })

  it('invalida o carrinho depois do checkout — o servidor esvaziou o grupo', async () => {
    /* Ao contrário das quatro rotas de carrinho, o POST de pedido NÃO devolve
       o carrinho novo: não há valor para semear, só para invalidar. */
    const getCart = vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: twoArenaCart(),
    })
    vi.spyOn(storeApi, 'createStoreOrder').mockResolvedValue({ ok: true, order: order() })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /CONFIRMAR/ }))

    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(2))
  })

  it('nomeia o produto e o saldo no 409 de estoque, sem sair da tela', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })
    vi.spyOn(storeApi, 'createStoreOrder').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'insufficient_stock',
      stockIssues: [
        { variantId: 'var-1', productName: 'Raquete Shark Pro', requested: 5, available: 2 },
      ],
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /CONFIRMAR/ }))

    expect(await screen.findByText('Estoque insuficiente')).toBeInTheDocument()
    expect(screen.getByText(/Raquete Shark Pro: você pediu 5 e restam 2/)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('explica o 409 empty_cart em vez de mostrar erro genérico', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })
    vi.spyOn(storeApi, 'createStoreOrder').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'empty_cart',
      stockIssues: [],
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /CONFIRMAR/ }))

    expect(await screen.findByText('Não há mais itens desta arena no carrinho')).toBeInTheDocument()
  })

  it('bloqueia o CONFIRMAR quando o grupo não é fechável', async () => {
    const cart = twoArenaCart()
    cart.groups[0].checkoutable = false
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart })
    const create = vi.spyOn(storeApi, 'createStoreOrder')

    renderPage()

    expect(await screen.findByRole('button', { name: /CONFIRMAR/ })).toBeDisabled()
    expect(screen.getByText(/Há item indisponível neste pedido/)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('diz que não há o que fechar quando a arena não está no carrinho', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage('unit-9')

    expect(await screen.findByText('Nada para fechar aqui')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CONFIRMAR/ })).not.toBeInTheDocument()
  })

  it('não inventa o endereço da retirada — ele só existe depois do pedido', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage()

    await screen.findByRole('heading', { name: 'Retirada' })
    expect(screen.getByText('Retirar na recepção')).toBeInTheDocument()
    expect(screen.queryByText(/Av\. Beira-Mar/)).not.toBeInTheDocument()
  })
})
