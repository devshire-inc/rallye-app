import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import type { StoreProduct, StoreVariant } from '../../lib/api/store'
import StoreProductPage from './StoreProductPage'
import { dimensionsOf, initialSelection, matchVariant } from './variants'

vi.mock('../../hooks/usePermission', () => ({ usePermission: () => false }))

afterEach(() => {
  vi.restoreAllMocks()
})

function variant(overrides: Partial<StoreVariant> = {}): StoreVariant {
  return {
    id: 'var-1',
    label: 'Preto · 340g',
    options: { cor: 'Preto', peso: '340g' },
    price: 389,
    stockQuantity: 8,
    inStock: true,
    ...overrides,
  }
}

function product(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: 'prod-1',
    unitId: 'unit-1',
    unitName: 'Arena Beira-Mar',
    name: 'Raquete Shark Pro',
    description: 'Fibra de carbono 3K.',
    category: 'raquetes',
    sport: 'beach_tennis',
    imageUrl: null,
    price: 389,
    compareAtPrice: 450,
    discountPercent: 14,
    badge: null,
    isActive: true,
    stockQuantity: 10,
    inStock: true,
    variants: [
      variant(),
      variant({
        id: 'var-2',
        label: 'Preto · 360g',
        options: { cor: 'Preto', peso: '360g' },
        price: 399,
        stockQuantity: 2,
      }),
      variant({
        id: 'var-3',
        label: 'Azul · 340g',
        options: { cor: 'Azul', peso: '340g' },
        price: 389,
        stockQuantity: 0,
        inStock: false,
      }),
    ],
    createdAt: '2026-08-01T09:12:34Z',
    ...overrides,
  }
}

function mockEmptyCart() {
  vi.spyOn(storeApi, 'getCart').mockResolvedValue({
    ok: true,
    cart: { groups: [], itemCount: 0, unitCount: 0, total: 0 },
  })
}

function renderPage() {
  return renderWithQuery(
    <MemoryRouter initialEntries={['/units/unit-1/store/products/prod-1']}>
      <Routes>
        <Route path="/units/:unitId/store/products/:productId" element={<StoreProductPage />} />
        <Route path="/store/cart" element={<div>Carrinho placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('derivação das dimensões de variação', () => {
  it('agrupa por chave preservando a ordem em que o backend devolve', () => {
    expect(dimensionsOf(product().variants)).toEqual([
      { key: 'cor', label: 'COR', values: ['Preto', 'Azul'] },
      { key: 'peso', label: 'PESO', values: ['340g', '360g'] },
    ])
  })

  it('não rende dimensão nenhuma para produto sem opções', () => {
    expect(dimensionsOf([variant({ label: '', options: {} })])).toEqual([])
  })

  it('resolve a variação pela combinação completa de opções', () => {
    const variants = product().variants
    expect(matchVariant(variants, { cor: 'Preto', peso: '360g' })?.id).toBe('var-2')
  })

  it('devolve null quando a combinação escolhida não existe em estoque nenhum', () => {
    // "Azul · 360g" nunca foi cadastrada.
    expect(matchVariant(product().variants, { cor: 'Azul', peso: '360g' })).toBeNull()
  })

  it('a seleção inicial é a primeira variação COM estoque', () => {
    const semEstoqueNaFrente = [
      variant({ id: 'var-0', options: { cor: 'Verde' }, stockQuantity: 0, inStock: false }),
      variant({ id: 'var-1', options: { cor: 'Preto' } }),
    ]
    expect(initialSelection(semEstoqueNaFrente)).toEqual({ cor: 'Preto' })
  })

  it('cai na primeira variação quando NENHUMA tem estoque', () => {
    const nenhuma = [
      variant({ id: 'var-0', options: { cor: 'Verde' }, stockQuantity: 0, inStock: false }),
      variant({ id: 'var-1', options: { cor: 'Preto' }, stockQuantity: 0, inStock: false }),
    ]
    expect(initialSelection(nenhuma)).toEqual({ cor: 'Verde' })
  })
})

describe('StoreProductPage', () => {
  it('mostra as duas faixas de chips com o rótulo da dimensão', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })

    renderPage()

    expect(await screen.findByText('COR')).toBeInTheDocument()
    expect(screen.getByText('PESO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Azul' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '340g' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '360g' })).toBeInTheDocument()
  })

  it('mostra o estoque e o preço DA VARIAÇÃO selecionada, não a soma do produto', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })
    const user = userEvent.setup()

    renderPage()
    // Seleção inicial: Preto · 340g (8 unidades, R$ 389) — não os 10 do produto.
    expect(await screen.findByText('Estoque: 8 unidades')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '360g' }))

    expect(await screen.findByText('Estoque: 2 unidades')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*399,00/)).toBeInTheDocument()
  })

  it('usa o percentual de desconto que o backend já calculou', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })

    renderPage()

    expect(await screen.findByText(/14% off/)).toBeInTheDocument()
  })

  it('bloqueia o botão quando a combinação escolhida não existe', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Estoque: 8 unidades')

    await user.click(screen.getByRole('button', { name: 'Azul' }))
    await user.click(screen.getByRole('button', { name: '360g' }))

    expect(await screen.findByText('Combinação indisponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' })).toBeDisabled()
  })

  it('bloqueia o botão quando a variação existe mas está esgotada', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Estoque: 8 unidades')

    await user.click(screen.getByRole('button', { name: 'Azul' }))

    expect(await screen.findByText('Esgotado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' })).toBeDisabled()
  })

  it('adiciona a VARIAÇÃO (não o produto) ao carrinho', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })
    const add = vi.spyOn(storeApi, 'addCartItem').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 1, unitCount: 1, total: 399 },
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Estoque: 8 unidades')
    await user.click(screen.getByRole('button', { name: '360g' }))
    await user.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }))

    await waitFor(() => expect(add).toHaveBeenCalledWith('unit-1', 'var-2', undefined))
    expect(await screen.findByText('Adicionado ao carrinho')).toBeInTheDocument()
  })

  it('explica o 409 out_of_stock em vez de mostrar um erro genérico', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })
    vi.spyOn(storeApi, 'addCartItem').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'out_of_stock',
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Estoque: 8 unidades')
    await user.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }))

    expect(await screen.findByText('Este item acabou de esgotar.')).toBeInTheDocument()
  })

  it('produto sem opções não mostra faixa de chip e já pode ser adicionado', async () => {
    mockEmptyCart()
    const simples = product({
      name: 'Overgrip Pack x3',
      description: '',
      compareAtPrice: null,
      discountPercent: null,
      variants: [variant({ id: 'var-only', label: '', options: {}, price: 29, stockQuantity: 40 })],
    })
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: simples })
    const add = vi.spyOn(storeApi, 'addCartItem').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 1, unitCount: 1, total: 29 },
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Estoque: 40 unidades')
    expect(screen.queryByText('COR')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }))

    await waitFor(() => expect(add).toHaveBeenCalledWith('unit-1', 'var-only', undefined))
  })

  it('não fabrica bloco de avaliações — o backend não tem reviews', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({ ok: true, product: product() })

    renderPage()
    await screen.findByText('Estoque: 8 unidades')

    expect(screen.queryByText(/Avaliações/)).not.toBeInTheDocument()
    expect(screen.queryByText(/VER TODAS/)).not.toBeInTheDocument()
  })

  it('trata 404 de produto inexistente com mensagem própria', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'getStoreProduct').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'product_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Produto não encontrado.')
  })
})
