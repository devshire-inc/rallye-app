import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import * as invoicesApi from '../../lib/api/invoices'
import * as pixApi from '../../lib/api/pixPayments'
import type { PixPayment, PixPaymentResult } from '../../lib/api/pixPayments'
import PixPaymentPage from './PixPaymentPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function payment(overrides: Partial<PixPayment> = {}): PixPayment {
  return {
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    status: 'pending',
    amount: 315,
    method: 'pix',
    provider: 'mock',
    mock: true,
    qrCode: 'MOCK-PIX-SEM-GATEWAY|RALLYE|BRL31500|NAO-PAGAVEL',
    /* Prazo bem à frente do relógio real do teste: a tela decide "pendente vs.
       expirado" comparando com Date.now(), então uma data fixa no passado
       tornaria todo teste de estado pendente um teste de expiração. */
    expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    invoiceStatus: 'gerada',
    ...overrides,
  }
}

function mockCharge(result: PixPaymentResult) {
  return vi.spyOn(pixApi, 'createPixCharge').mockResolvedValue(result)
}

function mockInvoice(description: string) {
  vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue({
    ok: true,
    invoice: {
      id: 'inv-1',
      studentId: 's-1',
      studentName: 'Marina Costa',
      sourceType: 'subscription',
      description,
      amount: 315,
      dueDate: '2026-03-10',
      status: 'gerada',
      paymentLink: null,
      paymentMethod: 'pix',
      paidAt: null,
      createdAt: '2026-03-01',
      events: [],
    },
  })
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/invoices/inv-1/pix']}>
      <Routes>
        <Route path="/invoices/:invoiceId/pix" element={<PixPaymentPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PixPaymentPage — cobrança pendente', () => {
  it('emite a cobrança na montagem e mostra o copia e cola com o valor real da API', async () => {
    const charge = mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pagar com PIX' }),
    ).toBeInTheDocument()
    expect(charge).toHaveBeenCalledWith('inv-1')
    expect(screen.getByText('MOCK-PIX-SEM-GATEWAY|RALLYE|BRL31500|NAO-PAGAVEL')).toBeInTheDocument()
  })

  it('mostra descrição e valor da fatura no subtítulo', async () => {
    mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(await screen.findByText(/Mensalidade Mar\/2026 ·/)).toBeInTheDocument()
  })

  it('continua utilizável quando a descrição da fatura falha (subtítulo só com o valor)', async () => {
    mockCharge({ ok: true, payment: payment() })
    vi.spyOn(invoicesApi, 'getInvoice').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal',
    })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Copiar código PIX' })).toBeInTheDocument()
  })

  it('NÃO renderiza QR Code e diz explicitamente que não há pagamento real', async () => {
    mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')

    const { container } = renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Pagar com PIX' })

    /* O `qr_code` da API é uma string mock impagável — a tela não pode
       transformá-la em imagem/canvas de QR, que é o que faria um app de banco
       tentar (e falhar) ao ler. Escopo no corpo da própria tela: o `container`
       inteiro inclui o chrome do AppShell, que tem a logo da marca em <img>. */
    const body = container.querySelector('.pix-body')
    expect(body).not.toBeNull()
    expect(body!.querySelector('img')).toBeNull()
    expect(body!.querySelector('canvas')).toBeNull()
    expect(body!.querySelector('svg[data-qr]')).toBeNull()

    expect(screen.getByText('AMBIENTE DE TESTE')).toBeInTheDocument()
    expect(screen.getByText('Sem QR Code para escanear.')).toBeInTheDocument()
    expect(screen.getByText(/não abre em nenhum app de banco/)).toBeInTheDocument()
  })

  it('omite os avisos de mock quando a cobrança não for mock (gateway real)', async () => {
    mockCharge({ ok: true, payment: payment({ mock: false, provider: 'gateway-real' }) })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Pagar com PIX' })

    expect(screen.queryByText('AMBIENTE DE TESTE')).not.toBeInTheDocument()
    expect(screen.queryByText(/não abre em nenhum app de banco/)).not.toBeInTheDocument()
  })

  it('não oferece nenhum botão de "já paguei" — a confirmação é do admin', async () => {
    mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Pagar com PIX' })

    expect(screen.getByText(/Aguardando confirmação do pagamento/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /já paguei/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmar pagamento/i })).not.toBeInTheDocument()
  })
})

describe('PixPaymentPage — polling', () => {
  it('consulta GET /payments/{id} e passa para o estado confirmado sem ação do usuário', async () => {
    mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')
    const poll = vi.spyOn(pixApi, 'getPixPayment').mockResolvedValue({
      ok: true,
      payment: payment({ confirmedAt: new Date().toISOString(), invoiceStatus: 'paga' }),
    })

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Pagar com PIX' })

    /* O intervalo real é de 5s; `waitFor` com timeout folgado é preferível a
       fake timers aqui, que brigam com os timers internos do react-query. */
    expect(
      await screen.findByRole('heading', { name: 'Pagamento confirmado' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(poll).toHaveBeenCalledWith('pay-1')
  }, 10_000)

  it('para de consultar depois que a cobrança sai de pendente', async () => {
    mockCharge({ ok: true, payment: payment() })
    mockInvoice('Mensalidade Mar/2026')
    const poll = vi.spyOn(pixApi, 'getPixPayment').mockResolvedValue({
      ok: true,
      payment: payment({ confirmedAt: new Date().toISOString(), invoiceStatus: 'paga' }),
    })

    renderPage()
    await screen.findByRole('heading', { name: 'Pagamento confirmado' }, { timeout: 8000 })
    const callsAtConfirmation = poll.mock.calls.length

    await new Promise((resolve) => setTimeout(resolve, 6000))
    expect(poll.mock.calls.length).toBe(callsAtConfirmation)
  }, 15_000)
})

describe('PixPaymentPage — expiração', () => {
  it('mostra o estado expirado e oferece gerar um novo código', async () => {
    mockCharge({
      ok: true,
      payment: payment({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
    })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Código expirado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerar novo código' })).toBeInTheDocument()
    expect(screen.queryByText(/Aguardando confirmação do pagamento/)).not.toBeInTheDocument()
  })

  it('reconhece o status expired do backend', async () => {
    mockCharge({ ok: true, payment: payment({ status: 'expired' }) })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Código expirado' })).toBeInTheDocument()
  })
})

describe('PixPaymentPage — falhas de emissão (frame 13b)', () => {
  it('mostra a cópia do frame de erro e permite tentar de novo numa falha transitória', async () => {
    mockCharge({ ok: false, status: 500, error: 'internal' })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Pagamento não aprovado' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Não conseguimos confirmar o PIX. Tente novamente ou gere um novo código.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
  })

  it('não oferece "Tentar novamente" num 409 — repetir daria o mesmo erro', async () => {
    mockCharge({ ok: false, status: 409, error: 'invoice_not_payable' })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Fatura não está em aberto' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
  })

  it('explica o 403 sem sugerir repetição', async () => {
    mockCharge({ ok: false, status: 403, error: 'forbidden' })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Sem acesso a esta fatura' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('explica o 404 sem sugerir repetição', async () => {
    mockCharge({ ok: false, status: 404, error: 'invoice_not_found' })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Fatura não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('retenta a emissão ao clicar em "Tentar novamente"', async () => {
    const charge = mockCharge({ ok: false, status: 500, error: 'internal' })
    mockInvoice('Mensalidade Mar/2026')

    renderPage()
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })

    charge.mockResolvedValue({ ok: true, payment: payment() })
    retry.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Pagar com PIX' })).toBeInTheDocument()
    })
  })
})
