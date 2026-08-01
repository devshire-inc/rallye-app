import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  addCartItem,
  getCart,
  getStoreProduct,
  listStoreProducts,
  removeCartItem,
  updateCartItemQuantity,
} from './store'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function productWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    unit_id: 'unit-1',
    unit_name: 'Arena Beira-Mar',
    name: 'Raquete Shark Pro',
    description: '',
    category: 'raquetes',
    sport: 'beach_tennis',
    image_url: null,
    price: 389,
    compare_at_price: 450,
    discount_percent: 13,
    badge: 'mais_vendido',
    is_active: true,
    stock_quantity: 8,
    in_stock: true,
    variants: [],
    created_at: '2026-08-01T09:12:34Z',
    ...overrides,
  }
}

function cartWire(overrides: Record<string, unknown> = {}) {
  return {
    groups: [
      {
        unit_id: 'unit-1',
        unit_name: 'Arena Beira-Mar',
        items: [
          {
            id: 'item-1',
            variant_id: 'var-1',
            product_id: 'prod-1',
            product_name: 'Raquete Shark Pro',
            variant_label: 'Preto · 340g',
            image_url: null,
            unit_price: 389,
            quantity: 1,
            line_total: 389,
            stock_quantity: 8,
            available: true,
          },
        ],
        subtotal: 389,
        checkoutable: true,
      },
    ],
    item_count: 1,
    unit_count: 1,
    total: 389,
    ...overrides,
  }
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe('listStoreProducts', () => {
  it('converte o payload wire para camelCase e expõe o nome da arena do topo', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        unit_id: 'unit-1',
        unit_name: 'Arena Beira-Mar',
        items: [productWire()],
      }),
    )

    const result = await listStoreProducts('unit-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unitName).toBe('Arena Beira-Mar')
    expect(result.products[0]).toMatchObject({
      id: 'prod-1',
      unitName: 'Arena Beira-Mar',
      compareAtPrice: 450,
      discountPercent: 13,
      badge: 'mais_vendido',
      stockQuantity: 8,
      inStock: true,
      variants: [],
    })
  })

  it('só manda os filtros preenchidos, e ignora uma busca em branco', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { unit_id: 'unit-1', unit_name: 'Arena', items: [] }),
    )

    await listStoreProducts('unit-1', { category: 'bolas', sport: null, q: '   ' })

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/store/products?category=bolas')
  })

  it('não coloca "?" na URL quando não há filtro nenhum', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { unit_id: 'unit-1', unit_name: 'Arena', items: [] }),
    )

    await listStoreProducts('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/store/products')
  })

  it('sobrevive a `items: null` (lista vazia, tela 22b) sem quebrar', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { unit_id: 'unit-1', unit_name: 'Arena Nova', items: null }),
    )

    const result = await listStoreProducts('unit-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.products).toEqual([])
    // A tela vazia precisa do nome da arena, e ele NÃO vem de um produto.
    expect(result.unitName).toBe('Arena Nova')
  })

  it('devolve ApiFailure com o código do backend em 404', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'unit_not_found' }))

    const result = await listStoreProducts('unit-x')

    expect(result).toEqual({ ok: false, status: 404, error: 'unit_not_found', message: undefined })
  })
})

describe('getStoreProduct', () => {
  it('traz as variações com options e o preço efetivo já resolvido', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(
        200,
        productWire({
          description: 'Fibra de carbono 3K',
          variants: [
            {
              id: 'var-1',
              label: 'Preto · 340g',
              options: { cor: 'Preto', peso: '340g' },
              price: 389,
              stock_quantity: 8,
              in_stock: true,
            },
          ],
        }),
      ),
    )

    const result = await getStoreProduct('unit-1', 'prod-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/store/products/prod-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.product.description).toBe('Fibra de carbono 3K')
    expect(result.product.variants[0]).toEqual({
      id: 'var-1',
      label: 'Preto · 340g',
      options: { cor: 'Preto', peso: '340g' },
      price: 389,
      stockQuantity: 8,
      inStock: true,
    })
  })

  it('trata `options: null` como produto sem opções, não como erro', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(
        200,
        productWire({
          variants: [
            {
              id: 'var-1',
              label: '',
              options: null,
              price: 29,
              stock_quantity: 40,
              in_stock: true,
            },
          ],
        }),
      ),
    )

    const result = await getStoreProduct('unit-1', 'prod-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.product.variants[0].options).toEqual({})
  })
})

describe('carrinho', () => {
  it('GET devolve o carrinho agrupado por arena', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, cartWire()))

    const result = await getCart()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/cart')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cart.groups[0]).toMatchObject({
      unitId: 'unit-1',
      unitName: 'Arena Beira-Mar',
      subtotal: 389,
      checkoutable: true,
    })
    expect(result.cart.groups[0].items[0]).toMatchObject({
      id: 'item-1',
      variantId: 'var-1',
      variantLabel: 'Preto · 340g',
      unitPrice: 389,
      available: true,
    })
  })

  it('POST manda unit_id/variant_id em snake_case e extrai o carrinho de dentro de `cart`', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { item_id: 'item-1', quantity: 1, cart: cartWire() }),
    )

    const result = await addCartItem('unit-1', 'var-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: 'unit-1', variant_id: 'var-1' }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cart.itemCount).toBe(1)
  })

  it('POST omite `quantity` do corpo quando não é passada (o backend assume 1)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { item_id: 'i', quantity: 1, cart: cartWire() }),
    )

    await addCartItem('unit-1', 'var-1')

    const body = JSON.parse(apiFetchMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('quantity')
  })

  it('POST inclui `quantity` quando ela é passada explicitamente', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { item_id: 'i', quantity: 3, cart: cartWire() }),
    )

    await addCartItem('unit-1', 'var-1', 3)

    expect(JSON.parse(apiFetchMock.mock.calls[0][1].body)).toMatchObject({ quantity: 3 })
  })

  it('propaga o 409 out_of_stock do POST', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'out_of_stock', message: 'sem estoque' }),
    )

    const result = await addCartItem('unit-1', 'var-1')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'out_of_stock',
      message: 'sem estoque',
    })
  })

  it('PATCH manda a quantidade nova e devolve o carrinho inteiro', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, cartWire({ item_count: 1, total: 778 })))

    const result = await updateCartItemQuantity('item-1', 2)

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/cart/items/item-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cart.total).toBe(778)
  })

  it('PATCH com 0 NÃO vira DELETE por baixo — o 400 do backend chega ao chamador', async () => {
    /* O contrato do backend é explícito: quantity 0 é 400, remover é DELETE.
       Este cliente não "conserta" isso silenciosamente; se traduzisse, a tela
       teria dois caminhos indistinguíveis para o mesmo efeito. */
    apiFetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_request' }))

    const result = await updateCartItemQuantity('item-1', 0)

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/me/store/cart/items/item-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(result).toMatchObject({ ok: false, status: 400, error: 'invalid_request' })
  })

  it('DELETE remove a linha e devolve o carrinho restante', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, cartWire({ groups: [], item_count: 0, unit_count: 0, total: 0 })),
    )

    const result = await removeCartItem('item-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/cart/items/item-1', { method: 'DELETE' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cart.itemCount).toBe(0)
    expect(result.cart.groups).toEqual([])
  })

  it('escapa o id do item na URL', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, cartWire()))

    await removeCartItem('item/1')

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/cart/items/item%2F1', { method: 'DELETE' })
  })
})
