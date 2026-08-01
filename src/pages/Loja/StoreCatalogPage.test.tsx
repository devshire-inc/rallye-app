import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import type { StoreCatalogFilters, StoreProduct } from '../../lib/api/store'
import StoreCatalogPage from './StoreCatalogPage'

// A `AppShell` que a página monta chama `usePermission` para o próprio
// gating de navegação e lança sem um `PermissionsProvider` ancestral (contrato
// fail-closed de BEAC-1841). Mesmo atalho de TournamentsListPage.test.tsx:
// mockar o hook em vez de montar o provider, já que nada aqui asserta sobre a
// nav da casca.
vi.mock('../../hooks/usePermission', () => ({ usePermission: () => false }))

afterEach(() => {
  vi.restoreAllMocks()
})

function product(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: 'prod-1',
    unitId: 'unit-1',
    unitName: 'Arena Beira-Mar',
    name: 'Raquete Shark Pro',
    description: '',
    category: 'raquetes',
    sport: 'beach_tennis',
    imageUrl: null,
    price: 389,
    compareAtPrice: 450,
    discountPercent: 13,
    badge: 'mais_vendido',
    isActive: true,
    stockQuantity: 8,
    inStock: true,
    variants: [],
    createdAt: '2026-08-01T09:12:34Z',
    ...overrides,
  }
}

function mockCatalog(products: StoreProduct[], unitName = 'Arena Beira-Mar') {
  return vi
    .spyOn(storeApi, 'listStoreProducts')
    .mockResolvedValue({ ok: true, unitId: 'unit-1', unitName, products })
}

function mockEmptyCart() {
  vi.spyOn(storeApi, 'getCart').mockResolvedValue({
    ok: true,
    cart: { groups: [], itemCount: 0, unitCount: 0, total: 0 },
  })
}

function renderPage() {
  return renderWithQuery(
    <MemoryRouter initialEntries={['/units/unit-1/store']}>
      <Routes>
        <Route path="/units/:unitId/store" element={<StoreCatalogPage />} />
        <Route
          path="/units/:unitId/store/products/:productId"
          element={<div>Detalhe do produto placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StoreCatalogPage — catálogo', () => {
  it('lista os produtos com preço, preço riscado, selo e arena', async () => {
    mockEmptyCart()
    mockCatalog([product()])

    renderPage()

    expect(
      await screen.findByText('Raquete Shark Pro', { selector: '.product-card__name' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*389,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*450,00/)).toBeInTheDocument()
    expect(screen.getByText('Mais vendido')).toBeInTheDocument()
    expect(screen.getByText('Arena Beira-Mar')).toBeInTheDocument()
  })

  it('não inventa avaliação — o card não mostra nenhuma nota', async () => {
    /* Gap conhecido: não existe review no backend da Loja. O frame desenha
       "⭐ 4.7 (23)" em todo card; a tela prefere a ausência a um número
       fabricado. */
    mockEmptyCart()
    mockCatalog([product()])

    renderPage()

    expect(
      await screen.findByText('Raquete Shark Pro', { selector: '.product-card__name' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/⭐/)).not.toBeInTheDocument()
  })

  it('abre o detalhe do produto no clique do card', async () => {
    mockEmptyCart()
    mockCatalog([product()])
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: /Raquete Shark Pro/ }))

    expect(await screen.findByText('Detalhe do produto placeholder')).toBeInTheDocument()
  })

  it('mostra o estado vazio da tela 22b nomeando a arena', async () => {
    mockEmptyCart()
    mockCatalog([], 'Arena Nova')

    renderPage()

    expect(await screen.findByText('Loja vazia por enquanto')).toBeInTheDocument()
    expect(screen.getByText(/Arena Nova/)).toBeInTheDocument()
  })

  it('mostra um vazio DIFERENTE quando o filtro é que não achou nada', async () => {
    mockEmptyCart()
    mockCatalog([])
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Loja vazia por enquanto')
    await user.click(screen.getByRole('button', { name: 'Bolas' }))

    expect(await screen.findByText('Nenhum produto encontrado')).toBeInTheDocument()
  })

  it('manda a categoria escolhida para o servidor, e a remove ao reclicar o chip', async () => {
    mockEmptyCart()
    const list = mockCatalog([product()])
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Raquete Shark Pro', { selector: '.product-card__name' })

    await user.click(screen.getByRole('button', { name: 'Bolas' }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith('unit-1', expect.objectContaining({ category: 'bolas' })),
    )

    // Reclicar volta ao filtro vazio. A asserção é sobre o ESTADO da faixa,
    // não sobre uma requisição nova: os filtros entram na chave da query, e o
    // resultado sem filtro já estava em cache desde a montagem — react-query
    // acertadamente não refaz a chamada.
    await user.click(screen.getByRole('button', { name: 'Bolas' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(screen.getByRole('button', { name: 'Bolas' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('"Todos" apenas zera a categoria — não é um valor do enum', async () => {
    mockEmptyCart()
    const list = mockCatalog([product()])
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Raquete Shark Pro', { selector: '.product-card__name' })
    await user.click(screen.getByRole('button', { name: 'Raquetes' }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        'unit-1',
        expect.objectContaining({ category: 'raquetes' }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Todos' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true'),
    )
    // Nenhuma requisição carregou "todos" como se fosse categoria.
    for (const call of list.mock.calls) {
      expect((call[1] as StoreCatalogFilters).category).not.toBe('todos')
    }
  })

  it('filtra por esporte pelo slug do backend', async () => {
    mockEmptyCart()
    const list = mockCatalog([product()])
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Raquete Shark Pro', { selector: '.product-card__name' })
    await user.click(screen.getByRole('button', { name: /Beach tennis/ }))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        'unit-1',
        expect.objectContaining({ sport: 'beach_tennis' }),
      ),
    )
  })

  it('distingue arena inexistente (404) de falha genérica', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'listStoreProducts').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'unit_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta arena não está disponível.')
  })

  it('mostra erro genérico quando a leitura falha por outro motivo', async () => {
    mockEmptyCart()
    vi.spyOn(storeApi, 'listStoreProducts').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a loja.')
  })

  it('mostra o contador do carrinho no cabeçalho, lido de /me/store/cart', async () => {
    vi.spyOn(storeApi, 'getCart').mockResolvedValue({
      ok: true,
      cart: { groups: [], itemCount: 3, unitCount: 2, total: 536 },
    })
    mockCatalog([product()])

    renderPage()

    expect(await screen.findByRole('link', { name: 'Carrinho, 3 itens' })).toBeInTheDocument()
  })
})
