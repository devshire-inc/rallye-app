import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  addCartItem,
  createStoreOrder,
  getCart,
  getStoreOrder,
  getStoreProduct,
  listStoreOrders,
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

function orderWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 42,
    number_label: '#0042',
    unit_id: 'unit-1',
    unit_name: 'Arena Beira-Mar',
    student_id: 'student-1',
    status: 'aguardando_pagamento',
    fulfillment_status: 'preparando',
    invoice_id: 'invoice-1',
    invoice_status: 'gerada',
    total: 447,
    item_count: 2,
    items: [
      {
        id: 'oi-1',
        variant_id: 'var-1',
        product_name: 'Raquete Shark Pro',
        variant_label: 'Preto · 340g',
        unit_price: 389,
        quantity: 1,
        line_total: 389,
      },
      {
        id: 'oi-2',
        variant_id: 'var-2',
        product_name: 'Overgrip Pack x3',
        variant_label: '',
        unit_price: 29,
        quantity: 2,
        line_total: 58,
      },
    ],
    pickup: {
      unit_name: 'Arena Beira-Mar',
      address: 'Av. Beira-Mar, 1200',
      city: 'Recife',
      state: 'PE',
    },
    created_at: '2026-03-24T12:00:00Z',
    ready_at: null,
    delivered_at: null,
    cancelled_at: null,
    ...overrides,
  }
}

describe('createStoreOrder — POST /me/store/orders', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('manda SÓ a arena no corpo — nunca itens, quantidades ou total', async () => {
    /* Itens e valores vêm do banco: mandar a lista abriria porta para
       preço/quantidade forjados, e mandar o total tornaria o servidor
       verificador de uma conta que ele mesmo faz. */
    apiFetchMock.mockResolvedValue(jsonResponse(201, orderWire()))

    await createStoreOrder('unit-1')

    const [path, init] = apiFetchMock.mock.calls[0]
    expect(path).toBe('/me/store/orders')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ unit_id: 'unit-1' })
  })

  it('converte o pedido criado, com número já formatado e a fatura do pagamento', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, orderWire()))

    const result = await createStoreOrder('unit-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.numberLabel).toBe('#0042')
    // É por esta fatura que o pedido é pago — a Loja não emite cobrança.
    expect(result.order.invoiceId).toBe('invoice-1')
    expect(result.order.status).toBe('aguardando_pagamento')
    expect(result.order.items).toHaveLength(2)
    expect(result.order.items[1].variantLabel).toBe('')
    expect(result.order.pickup).toEqual({
      unitName: 'Arena Beira-Mar',
      address: 'Av. Beira-Mar, 1200',
      city: 'Recife',
      state: 'PE',
    })
  })

  it('carrega as linhas do 409 insufficient_stock — pedido e disponível por produto', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'insufficient_stock',
        message: 'estoque insuficiente',
        items: [
          { variant_id: 'var-1', product_name: 'Raquete Shark Pro', requested: 5, available: 2 },
        ],
      }),
    )

    const result = await createStoreOrder('unit-1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('insufficient_stock')
    expect(result.stockIssues).toEqual([
      { variantId: 'var-1', productName: 'Raquete Shark Pro', requested: 5, available: 2 },
    ])
  })

  it('409 empty_cart chega como falha, com stockIssues vazio', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(409, { error: 'empty_cart' }))

    const result = await createStoreOrder('unit-1')

    expect(result).toMatchObject({ ok: false, status: 409, error: 'empty_cart', stockIssues: [] })
  })
})

describe('listStoreOrders / getStoreOrder — /me/store/orders', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('lista atravessa arenas, na ordem que o backend devolve', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        items: [
          orderWire(),
          orderWire({
            id: 'order-2',
            number_label: '#0038',
            unit_id: 'unit-2',
            unit_name: 'Beach Master Barra',
            status: 'entregue',
          }),
        ],
      }),
    )

    const result = await listStoreOrders()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/orders')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.orders.map((order) => order.unitName)).toEqual([
      'Arena Beira-Mar',
      'Beach Master Barra',
    ])
  })

  it('items ausente na listagem vira lista vazia, não quebra', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { items: null }))

    const result = await listStoreOrders()

    expect(result).toEqual({ ok: true, orders: [] })
  })

  it('detalhe escapa o id e propaga o 404 de pedido alheio', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'order_not_found' }))

    const result = await getStoreOrder('order/1')

    expect(apiFetchMock).toHaveBeenCalledWith('/me/store/orders/order%2F1')
    expect(result).toMatchObject({ ok: false, status: 404, error: 'order_not_found' })
  })

  it('pickup ausente cai no nome da arena, sem endereço inventado', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, orderWire({ pickup: null })))

    const result = await getStoreOrder('order-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.pickup).toEqual({
      unitName: 'Arena Beira-Mar',
      address: '',
      city: '',
      state: '',
    })
  })
})
