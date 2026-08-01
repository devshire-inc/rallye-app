import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import type { Cart, CartItem } from '../../lib/api/store'
import StoreCartPage from './StoreCartPage'

vi.mock('../../hooks/usePermission', () => ({ usePermission: () => false }))

afterEach(() => {
  vi.restoreAllMocks()
})

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
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
    ...overrides,
  }
}

/** O carrinho do frame 24: duas arenas, três linhas, R$ 536,00. */
function twoArenaCart(): Cart {
  return {
    groups: [
      {
        unitId: 'unit-1',
        unitName: 'Arena Beira-Mar',
        items: [
          item(),
          item({
            id: 'item-2',
            variantId: 'var-2',
            productName: 'Overgrip Pack x3',
            variantLabel: '',
            unitPrice: 29,
            quantity: 2,
            lineTotal: 58,
          }),
        ],
        subtotal: 447,
        checkoutable: true,
      },
      {
        unitId: 'unit-2',
        unitName: 'Beach Master Barra',
        items: [
          item({
            id: 'item-3',
            variantId: 'var-3',
            productName: 'Viseira Nike',
            variantLabel: '',
            unitPrice: 89,
            lineTotal: 89,
          }),
        ],
        subtotal: 89,
        checkoutable: true,
      },
    ],
    itemCount: 3,
    unitCount: 2,
    total: 536,
  }
}

function singleArenaCart(items: CartItem[]): Cart {
  return {
    groups: [
      {
        unitId: 'unit-1',
        unitName: 'Arena Beira-Mar',
        items,
        subtotal: 389,
        checkoutable: true,
      },
    ],
    itemCount: items.length,
    unitCount: 1,
    total: 389,
  }
}

function renderPage() {
  return renderWithQuery(
    <MemoryRouter initialEntries={['/store/cart']}>
      <Routes>
        <Route path="/store/cart" element={<StoreCartPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StoreCartPage — carrinho cross-arena', () => {
  it('agrupa os itens por arena e conta LINHAS no título', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Carrinho (3 itens)' })).toBeInTheDocument()
    // O 🏟️ do frame é decorativo (::before no CSS), fora do nome acessível.
    expect(screen.getByRole('heading', { name: 'Arena Beira-Mar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Beach Master Barra' })).toBeInTheDocument()
  })

  it('mostra o aviso de arenas diferentes só quando há mais de uma', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage()

    expect(await screen.findByText(/retirados em cada arena separadamente/)).toBeInTheDocument()
  })

  it('não mostra o aviso com uma arena só', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })

    renderPage()

    await screen.findByRole('heading', { name: 'Carrinho (1 item)' })
    expect(screen.queryByText(/retirados em cada arena separadamente/)).not.toBeInTheDocument()
  })

  it('aumenta a quantidade por PATCH', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })
    const patch = vi.spyOn(storeApi, 'updateCartItemQuantity').mockResolvedValue({
      ok: true,
      cart: singleArenaCart([item({ quantity: 2, lineTotal: 778 })]),
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Aumentar quantidade de Raquete Shark Pro' }),
    )

    await waitFor(() => expect(patch).toHaveBeenCalledWith('item-1', 2))
  })

  it('o "−" para em 1 — nunca manda PATCH com quantity 0 (que é 400 no backend)', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })
    const patch = vi.spyOn(storeApi, 'updateCartItemQuantity')

    renderPage()

    const minus = await screen.findByRole('button', {
      name: 'Diminuir quantidade de Raquete Shark Pro',
    })
    expect(minus).toBeDisabled()
    expect(patch).not.toHaveBeenCalled()
  })

  it('diminui por PATCH quando a quantidade é maior que 1', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: singleArenaCart([item({ quantity: 3 })]),
    })
    const patch = vi.spyOn(storeApi, 'updateCartItemQuantity').mockResolvedValue({
      ok: true,
      cart: singleArenaCart([item({ quantity: 2 })]),
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Diminuir quantidade de Raquete Shark Pro' }),
    )

    await waitFor(() => expect(patch).toHaveBeenCalledWith('item-1', 2))
  })

  it('remover usa DELETE, não um PATCH com 0', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })
    const remove = vi.spyOn(storeApi, 'removeCartItem').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 0, unitCount: 0, total: 0 },
    })
    const patch = vi.spyOn(storeApi, 'updateCartItemQuantity')
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /Remover, Raquete Shark Pro/ }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('item-1'))
    expect(patch).not.toHaveBeenCalled()
  })

  it('a resposta da mutação realimenta a tela sem um GET extra', async () => {
    const get = vi
      .spyOn(storeApi, 'getCart')
      .mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })
    vi.spyOn(storeApi, 'removeCartItem').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 0, unitCount: 0, total: 0 },
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /Remover, Raquete Shark Pro/ }))

    expect(await screen.findByText('Seu carrinho está vazio')).toBeInTheDocument()
    // Um GET só: o da montagem. As quatro rotas devolvem o carrinho inteiro.
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('mantém visível o item indisponível, marcado — não some com ele', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: singleArenaCart([item({ available: false, quantity: 5, stockQuantity: 2 })]),
    })

    renderPage()

    expect(await screen.findByText('Indisponível nesta quantidade')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remover, Raquete Shark Pro/ })).toBeEnabled()
  })

  it('mostra subtotal e total do carrinho inteiro', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: twoArenaCart() })

    renderPage()

    await screen.findByRole('heading', { name: 'Carrinho (3 itens)' })
    expect(screen.getAllByText(/R\$\s*536,00/)).toHaveLength(2)
  })

  it('"FINALIZAR COMPRA" fica desabilitado com o motivo escrito — checkout é a próxima leva', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: true, cart: singleArenaCart([item()]) })

    renderPage()

    expect(await screen.findByRole('button', { name: 'FINALIZAR COMPRA' })).toBeDisabled()
    expect(screen.getByText(/O fechamento do pedido chega em breve/)).toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há item nenhum', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 0, unitCount: 0, total: 0 },
    })

    renderPage()

    expect(await screen.findByText('Seu carrinho está vazio')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'FINALIZAR COMPRA' })).not.toBeInTheDocument()
  })

  it('avisa quando a mutação falha, sem perder o carrinho da tela', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: singleArenaCart([item({ quantity: 2 })]),
    })
    vi.spyOn(storeApi, 'updateCartItemQuantity').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal',
    })
    const user = userEvent.setup()

    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Aumentar quantidade de Raquete Shark Pro' }),
    )

    expect(await screen.findByText('Não foi possível atualizar o carrinho.')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade: 2')).toBeInTheDocument()
  })

  it('mostra erro quando o carrinho não carrega', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({ ok: false, status: 500, error: 'internal' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o carrinho.',
    )
  })
})
