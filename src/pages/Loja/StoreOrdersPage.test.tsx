import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/renderWithQuery'
import * as storeApi from '../../lib/api/store'
import StoreOrdersPage from './StoreOrdersPage'
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

/** Os quatro pedidos do frame 27 — duas arenas na mesma lista. */
function frameOrders() {
  return [
    order({ id: 'o-42', numberLabel: '#0042', status: 'pronto', total: 447, itemCount: 2 }),
    order({
      id: 'o-40',
      numberLabel: '#0040',
      status: 'preparando',
      total: 35,
      itemCount: 1,
      createdAt: '2026-03-20T12:00:00Z',
    }),
    order({
      id: 'o-38',
      numberLabel: '#0038',
      unitId: 'unit-2',
      unitName: 'Beach Master Barra',
      status: 'entregue',
      total: 89,
      itemCount: 1,
      createdAt: '2026-03-15T12:00:00Z',
    }),
    order({
      id: 'o-35',
      numberLabel: '#0035',
      status: 'entregue',
      total: 35,
      itemCount: 1,
      createdAt: '2026-03-08T12:00:00Z',
    }),
  ]
}

function renderPage() {
  navigate.mockReset()
  return renderWithQuery(
    <MemoryRouter initialEntries={['/store/orders']}>
      <Routes>
        <Route path="/store/orders" element={<StoreOrdersPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StoreOrdersPage — tela 27', () => {
  it('lista pedidos de arenas diferentes na ordem do backend', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: frameOrders() })

    renderPage()

    // Cada pedido aparece duas vezes no DOM (card do mobile + linha da
    // tabela do desktop) — a troca é 100% CSS, os dois layouts coexistem.
    expect(await screen.findAllByText('#0042 · 24/03/2026')).toHaveLength(2)
    expect(screen.getAllByText('Beach Master Barra')).toHaveLength(2)
  })

  it('renderiza a tabela do desktop com as cinco colunas do frame', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: frameOrders() })

    renderPage()

    const table = await screen.findByRole('table', { name: 'Meus pedidos' })
    for (const header of ['PEDIDO', 'ARENA', 'ITENS', 'VALOR', 'STATUS']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    expect(within(table).getAllByRole('row')).toHaveLength(5) // cabeçalho + 4
  })

  it('escreve "1 item"/"2 itens" contando LINHAS', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: frameOrders() })

    renderPage()

    expect(await screen.findAllByText(/2 itens · R\$\s*447,00/)).toHaveLength(1) // card
    const table = screen.getByRole('table', { name: 'Meus pedidos' })
    expect(within(table).getAllByText('1 item')).toHaveLength(3)
  })

  it('abre o detalhe do pedido pela célula de ação — a linha inteira não é clicável', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: frameOrders() })
    const user = userEvent.setup()

    renderPage()
    const table = await screen.findByRole('table', { name: 'Meus pedidos' })
    await user.click(within(table).getByRole('button', { name: /Ver ›, pedido #0042/ }))

    expect(navigate).toHaveBeenCalledWith('/store/orders/o-42')
  })

  it('a ação vira "Pagar agora" no pedido aguardando pagamento', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({
      ok: true,
      orders: [order({ status: 'aguardando_pagamento' })],
    })

    renderPage()

    const table = await screen.findByRole('table', { name: 'Meus pedidos' })
    expect(
      within(table).getByRole('button', { name: /Pagar agora, pedido #0042/ }),
    ).toBeInTheDocument()
  })

  it('mostra o status derivado de cada pedido', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: frameOrders() })

    renderPage()

    expect(await screen.findAllByText('Pronto para retirada')).toHaveLength(2)
    expect(screen.getAllByText('Preparando')).toHaveLength(2)
    expect(screen.getAllByText('Entregue')).toHaveLength(4) // 2 pedidos × 2 layouts
  })

  it('mostra o estado vazio quando não há pedido nenhum', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({ ok: true, orders: [] })

    renderPage()

    expect(await screen.findByText('Nenhum pedido ainda')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('avisa quando a lista não carrega', async () => {
    vi.spyOn(storeApi, 'listStoreOrders').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar seus pedidos.',
    )
  })
})
