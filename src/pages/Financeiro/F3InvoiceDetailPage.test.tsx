import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as invoicesApi from '../../lib/api/invoices'
import type { GetInvoiceResult, InvoiceDetail } from '../../lib/api/invoices'
import F3InvoiceDetailPage from './F3InvoiceDetailPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockCanManage(canManage: boolean) {
  vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue(canManage)
}

function invoiceDetail(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    studentId: 's-1',
    studentName: 'João Pedro',
    sourceType: 'subscription',
    description: 'Mensalidade julho',
    amount: 189.9,
    dueDate: '2026-07-10',
    status: 'paga',
    paymentLink: null,
    paymentMethod: 'pix',
    paidAt: '2026-07-03',
    createdAt: '2026-07-01',
    events: [],
    ...overrides,
  }
}

function detailOk(invoice: InvoiceDetail): GetInvoiceResult {
  return { ok: true, invoice }
}

function renderPage() {
  return renderWithQuery(
    <MemoryRouter initialEntries={['/invoices/inv-1']}>
      <Routes>
        <Route path="/invoices/:invoiceId" element={<F3InvoiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('F3InvoiceDetailPage — botão "Estornar" (BEAC-1952)', () => {
  it('shows "Estornar" for Admin (financeiro:write) when status is paga', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'paga' })),
    )

    renderPage()

    expect(await screen.findByRole('button', { name: 'Estornar' })).toBeInTheDocument()
  })

  it('hides "Estornar" when status is not paga', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'enviada', paidAt: null })),
    )

    renderPage()

    await screen.findByText('Mensalidade julho')
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument()
  })

  it('hides "Estornar" for a role without financeiro:write, even if status is paga (read-only role)', async () => {
    mockCanManage(false)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'paga' })),
    )

    renderPage()

    await screen.findByText('Mensalidade julho')
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument()
  })
})

describe('F3InvoiceDetailPage — sheet de estorno (#sheet-estorno, cópia do protótipo)', () => {
  it('opens with subtitle "descrição · aluno · paga em DD/MM/AAAA · valor" and Total pre-selected', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(
        invoiceDetail({
          description: 'Mensalidade julho',
          studentName: 'João Pedro',
          paidAt: '2026-07-03',
          amount: 189.9,
        }),
      ),
    )

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))

    expect(
      screen.getByText('Mensalidade julho · João Pedro · paga em 03/07/2026 · R$ 189,90'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Total — R$ 189,90' })).toHaveClass('active')
    expect(screen.getByText('Estorno total cancela a fatura por completo.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Valor a estornar')).not.toBeInTheDocument()
  })

  it('switching to "Parcial" reveals the amount field and swaps the rule toast', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(detailOk(invoiceDetail()))

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Parcial' }))

    expect(screen.getByLabelText('Valor a estornar')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Estorno parcial mantém o status "Paga", com o registro do estorno anexado ao histórico da fatura.',
      ),
    ).toBeInTheDocument()
  })

  it('"Confirmar estorno" is disabled for Parcial until a positive amount is entered', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(detailOk(invoiceDetail()))

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Parcial' }))

    const confirm = screen.getByRole('button', { name: 'Confirmar estorno' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Valor a estornar'), { target: { value: '50' } })
    expect(confirm).not.toBeDisabled()
  })

  it('confirming Total calls refundInvoice({type: "total"}) and shows the success copy', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(detailOk(invoiceDetail()))
    const refundSpy = vi
      .spyOn(invoicesApi, 'refundInvoice')
      .mockResolvedValue({ ok: true, status: 'estornada', amount: 189.9 })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar estorno' }))

    await waitFor(() => expect(refundSpy).toHaveBeenCalledWith('inv-1', 'total', undefined))
    expect(await screen.findByText('Fatura estornada e cancelada.')).toBeInTheDocument()
  })

  it('confirming Parcial calls refundInvoice({type: "parcial", amount}) and shows the success copy', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(detailOk(invoiceDetail()))
    const refundSpy = vi
      .spyOn(invoicesApi, 'refundInvoice')
      .mockResolvedValue({ ok: true, status: 'paga', amount: 139.9 })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Parcial' }))
    fireEvent.change(screen.getByLabelText('Valor a estornar'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar estorno' }))

    await waitFor(() => expect(refundSpy).toHaveBeenCalledWith('inv-1', 'parcial', 50))
    expect(
      await screen.findByText('Estorno parcial registrado — fatura continua "Paga".'),
    ).toBeInTheDocument()
  })

  it('shows an error toast and keeps the sheet open when the backend rejects the refund (e.g. 7-day window expired)', async () => {
    mockCanManage(true)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(detailOk(invoiceDetail()))
    vi.spyOn(invoicesApi, 'refundInvoice').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'refund_window_expired',
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar estorno' }))

    expect(await screen.findByText('Não foi possível estornar a fatura.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar estorno' })).toBeInTheDocument()
  })
})

describe('F3InvoiceDetailPage — CTA do Aluno para a tela 13 (Pagamento PIX)', () => {
  /* A rota real de destino é /invoices/:invoiceId/pix (App.tsx). Aqui ela é
     montada com um elemento sentinela para o teste afirmar a NAVEGAÇÃO em si,
     sem arrastar PixPaymentPage (e os fetches dela) para dentro deste arquivo. */
  function renderWithPixRoute() {
    return renderWithQuery(
      <MemoryRouter initialEntries={['/invoices/inv-1']}>
        <Routes>
          <Route path="/invoices/:invoiceId" element={<F3InvoiceDetailPage />} />
          <Route path="/invoices/:invoiceId/pix" element={<p>tela de pagamento PIX</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('navega para a tela de PIX em vez de abrir o payment_link numa aba', async () => {
    mockCanManage(false)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'enviada', paidAt: null, paymentLink: null })),
    )

    renderWithPixRoute()
    fireEvent.click(await screen.findByRole('button', { name: 'Pagar agora com PIX' }))

    expect(await screen.findByText('tela de pagamento PIX')).toBeInTheDocument()
  })

  it('mostra o CTA mesmo sem payment_link — a cobrança PIX não depende dele', async () => {
    mockCanManage(false)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'gerada', paidAt: null, paymentLink: null })),
    )

    renderPage()

    expect(
      await screen.findByRole('button', { name: 'Pagar agora com PIX' }),
    ).toBeInTheDocument()
  })

  it('esconde o CTA quando a fatura não é mais pagável', async () => {
    mockCanManage(false)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(invoiceDetail({ status: 'paga', paymentLink: 'https://pagar.exemplo/inv-1' })),
    )

    renderPage()
    await screen.findByText('Mensalidade julho')

    expect(screen.queryByRole('button', { name: 'Pagar agora com PIX' })).not.toBeInTheDocument()
  })

  it('mantém o payment_link exibido na caixa de copiar — ele não sumiu, só deixou de ser o CTA', async () => {
    mockCanManage(false)
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue(
      detailOk(
        invoiceDetail({
          status: 'enviada',
          paidAt: null,
          paymentLink: 'https://pagar.exemplo/inv-1',
        }),
      ),
    )

    renderPage()

    expect(await screen.findByText('https://pagar.exemplo/inv-1')).toBeInTheDocument()
  })
})
