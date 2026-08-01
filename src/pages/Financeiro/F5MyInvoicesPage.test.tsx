import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as invoicesApi from '../../lib/api/invoices'
import type { InvoiceListItem, ListInvoicesResult } from '../../lib/api/invoices'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import F5MyInvoicesPage from './F5MyInvoicesPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    studentId: 'student-1',
    studentName: 'Aluno Teste',
    sourceType: 'subscription',
    description: 'Mensalidade julho',
    amount: 200,
    dueDate: '2026-08-10',
    status: 'gerada',
    daysOverdue: null,
    paymentMethod: null,
    paidAt: null,
    ...overrides,
  }
}

function invoicesOk(invoices: InvoiceListItem[]): ListInvoicesResult {
  return { ok: true, invoices, total: invoices.length }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/my-invoices']}>
      <Routes>
        <Route path="/units/:unitId/my-invoices" element={<F5MyInvoicesPage />} />
        <Route path="/invoices/:invoiceId" element={<div>Detalhe da fatura placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * A tela renderiza os DOIS layouts (cards mobile + tabela desktop) no DOM
 * ao mesmo tempo — a troca é 100% CSS no breakpoint de 860px, e jsdom não
 * aplica CSS. Então toda query sobre conteúdo de fatura precisa ser
 * escopada a um dos dois layouts, senão casa com os dois (falso positivo
 * ou "found multiple elements"). Estes helpers são o contrato: quem testar
 * as próximas telas com layout duplo (Torneios/Loja) deve copiá-los em vez
 * de usar `screen.getByText` cru.
 */
async function cards() {
  await waitFor(() => {
    if (!document.querySelector('.invoices-cards')) {
      throw new Error('layout de cards (mobile) não está no DOM')
    }
  })
  return within(document.querySelector('.invoices-cards') as HTMLElement)
}

async function table() {
  return within(await screen.findByRole('table'))
}

describe('F5MyInvoicesPage — estados de carregamento/erro', () => {
  it('shows a loading status while invoices are being fetched', () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'unknown_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('F5MyInvoicesPage — aba Abertas (default)', () => {
  it('shows the empty state when there are no open invoices', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ status: 'paga' })]),
    )

    renderPage()

    expect(await screen.findByText(/nenhuma fatura pendente/i)).toBeInTheDocument()
    // O empty state substitui os dois layouts, não só os cards.
    expect(document.querySelector('.invoices-cards')).toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('groups overdue and pending invoices under separate headers (cards)', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({
          id: 'inv-atrasada',
          status: 'atrasada',
          daysOverdue: 5,
          description: 'Mensalidade junho',
        }),
        invoice({ id: 'inv-pendente', status: 'gerada', description: 'Mensalidade julho' }),
      ]),
    )

    renderPage()

    // Headers de grupo do mobile: só o texto, sem os emojis do markup antigo.
    expect(await (await cards()).findByText('Atrasada')).toBeInTheDocument()
    expect((await cards()).getByText('Pendente')).toBeInTheDocument()
    expect((await cards()).getByText('Mensalidade junho')).toBeInTheDocument()
    expect((await cards()).getByText('Mensalidade julho')).toBeInTheDocument()
    // Badge por fatura (com o sinal gráfico só no card).
    expect((await cards()).getByText('● Atrasada')).toBeInTheDocument()
    expect((await cards()).getByText('● Pendente')).toBeInTheDocument()
  })

  it('lists the same open invoices in the desktop table, overdue first', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({ id: 'inv-pendente', status: 'gerada', description: 'Mensalidade julho' }),
        invoice({
          id: 'inv-atrasada',
          status: 'atrasada',
          daysOverdue: 5,
          description: 'Mensalidade junho',
        }),
      ]),
    )

    renderPage()

    expect(await screen.findByRole('table', { name: 'Faturas em aberto' })).toBeInTheDocument()

    const headers = (await table()).getAllByRole('columnheader').map((th) => th.textContent)
    // Maiúsculas literais (overline do Figma; o DS não aplica
    // text-transform), + o rótulo oculto da coluna de ação.
    expect(headers).toEqual(['DESCRIÇÃO', 'VALOR', 'DATA', 'STATUS', 'Ação'])

    // A tabela é plana (sem headers de grupo), mas preserva a ordem do
    // agrupamento: atrasadas antes das pendentes.
    const rows = (await table()).getAllByRole('row').slice(1) // [0] é o header
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Mensalidade junho',
      'Mensalidade julho',
    ])
    // Badge da tabela: sem os sinais ●/✓ do card.
    expect((await table()).getByText('Atrasada')).toBeInTheDocument()
    expect((await table()).getByText('Pendente')).toBeInTheDocument()
  })

  it('gives each table action button a unique accessible name', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({ id: 'inv-1', status: 'gerada', description: 'Mensalidade julho' }),
        invoice({ id: 'inv-2', status: 'gerada', description: 'Mensalidade agosto' }),
      ]),
    )

    renderPage()

    expect(
      await (await table()).findByRole('button', { name: 'Pagar agora, Mensalidade julho' }),
    ).toBeInTheDocument()
    expect(
      (await table()).getByRole('button', { name: 'Pagar agora, Mensalidade agosto' }),
    ).toBeInTheDocument()
  })

  it('navigates to the invoice detail page when the card "PAGAR AGORA" is clicked', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-1', status: 'gerada' })]),
    )

    renderPage()

    fireEvent.click(await (await cards()).findByRole('button', { name: 'PAGAR AGORA' }))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })

  it('navigates to the invoice detail page from the table action button', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-1', status: 'gerada', description: 'Mensalidade julho' })]),
    )

    renderPage()

    fireEvent.click(
      await (await table()).findByRole('button', { name: 'Pagar agora, Mensalidade julho' }),
    )

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })
})

describe('F5MyInvoicesPage — aba Pagas', () => {
  it('switches to Pagas and lists paid invoices with their payment method', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({
          id: 'inv-paga',
          status: 'paga',
          description: 'Mensalidade maio',
          paymentMethod: 'pix',
          paidAt: '2026-06-01',
        }),
      ]),
    )

    renderPage()
    // Tabs do design system expõem `role="tab"`, não `button`.
    fireEvent.click(await screen.findByRole('tab', { name: 'Pagas' }))

    expect(await (await cards()).findByText('Mensalidade maio')).toBeInTheDocument()
    expect((await cards()).getByText(/pago via pix/i)).toBeInTheDocument()
    expect((await cards()).getByText('✓ Paga')).toBeInTheDocument()
    // Fatura paga não oferece ação de pagamento no card.
    expect((await cards()).queryByRole('button', { name: 'PAGAR AGORA' })).not.toBeInTheDocument()

    // Mesma fatura na tabela, com a ação de consulta em vez de pagamento.
    expect(screen.getByRole('table', { name: 'Faturas pagas' })).toBeInTheDocument()
    expect((await table()).getByText('Mensalidade maio')).toBeInTheDocument()
    expect((await table()).getByRole('button', { name: 'Ver ›, Mensalidade maio' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no paid invoices', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([]))

    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Pagas' }))

    expect(await screen.findByText(/nenhum pagamento registrado/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('navigates to the invoice detail page when a paid card is clicked', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-paga', status: 'paga', description: 'Mensalidade maio' })]),
    )

    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Pagas' }))
    fireEvent.click(await (await cards()).findByText('Mensalidade maio'))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })

  it('navigates to the invoice detail page from the table action of a paid invoice', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-paga', status: 'paga', description: 'Mensalidade maio' })]),
    )

    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Pagas' }))
    fireEvent.click(await (await table()).findByRole('button', { name: 'Ver ›, Mensalidade maio' }))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })
})
