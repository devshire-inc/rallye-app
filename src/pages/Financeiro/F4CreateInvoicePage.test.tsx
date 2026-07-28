import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as invoicesApi from '../../lib/api/invoices'
import * as membersApi from '../../lib/api/members'
import type { Member } from '../../lib/api/members'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import F4CreateInvoicePage from './F4CreateInvoicePage'

afterEach(() => {
  vi.restoreAllMocks()
})

function student(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-1',
    user: { id: 'user-1', name: 'João Pedro', email: 'joao@example.com', avatarUrl: null },
    role: { id: 'role-aluno', name: 'Aluno' },
    ...overrides,
  }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/invoices/new']}>
      <Routes>
        <Route path="/units/:unitId/invoices/new" element={<F4CreateInvoicePage />} />
        <Route path="/units/:unitId/invoices" element={<div>Lista de faturas placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function selectStudent(listSpy: ReturnType<typeof vi.spyOn>) {
  fireEvent.change(screen.getByLabelText('ALUNO *'), { target: { value: 'João' } })
  await waitFor(() => expect(listSpy).toHaveBeenCalledWith('unit-1', 'João'), { timeout: 1000 })
  fireEvent.click(await screen.findByText('João Pedro'))
}

describe('F4CreateInvoicePage — campos principais', () => {
  it('renders the header, the 4 type pills and a submit button disabled by default', () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Criar Cobrança' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mensalidade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pacote' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Torneio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avulso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CRIAR COBRANÇA' })).toBeDisabled()
  })
})

describe('F4CreateInvoicePage — busca e seleção de aluno (debounce 300ms)', () => {
  it('lists matches after the debounce and fills the field on selection', async () => {
    const listSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [student()] })

    renderPage()
    await selectStudent(listSpy)

    expect(screen.getByLabelText('ALUNO *')).toHaveValue('João Pedro')
    // A lista de sugestões some assim que um aluno é selecionado.
    expect(screen.queryByText('joao@example.com')).not.toBeInTheDocument()
  })
})

describe('F4CreateInvoicePage — pre-fill por tipo', () => {
  it('prefills the description for "Mensalidade" with the current month label', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Mensalidade' }))

    const description = screen.getByLabelText('DESCRIÇÃO *') as HTMLInputElement
    expect(description.value).toContain('Mensalidade')
  })

  it('leaves the description empty for "Avulso" (100% covered case, no prefix)', async () => {
    vi.spyOn(membersApi, 'listMembers').mockResolvedValue({ ok: true, members: [] })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Mensalidade' }))
    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }))

    expect(screen.getByLabelText('DESCRIÇÃO *')).toHaveValue('')
  })
})

describe('F4CreateInvoicePage — criação de cobrança', () => {
  it('creates the invoice with the filled data and navigates back to the invoice list', async () => {
    const listSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [student()] })
    const createSpy = vi
      .spyOn(invoicesApi, 'createInvoice')
      .mockResolvedValue({ ok: true, invoiceId: 'inv-1' })

    renderPage()
    await selectStudent(listSpy)

    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }))
    fireEvent.change(screen.getByLabelText('DESCRIÇÃO *'), { target: { value: 'Aula extra' } })
    fireEvent.change(screen.getByLabelText('VALOR *'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('VENCIMENTO *'), { target: { value: '2026-08-10' } })

    const submit = screen.getByRole('button', { name: 'CRIAR COBRANÇA' })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith('unit-1', {
        studentId: 'user-1',
        type: 'avulso',
        description: 'Aula extra',
        amount: 150,
        dueDate: '2026-08-10',
        generateLink: true,
        sendWhatsApp: true,
        sendEmail: true,
      }),
    )
    expect(await screen.findByText('Lista de faturas placeholder')).toBeInTheDocument()
  })

  it('unchecking a delivery option omits it from the submitted payload (checkboxes default checked)', async () => {
    const listSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [student()] })
    const createSpy = vi
      .spyOn(invoicesApi, 'createInvoice')
      .mockResolvedValue({ ok: true, invoiceId: 'inv-1' })

    renderPage()
    await selectStudent(listSpy)

    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }))
    fireEvent.change(screen.getByLabelText('DESCRIÇÃO *'), { target: { value: 'Aula extra' } })
    fireEvent.change(screen.getByLabelText('VALOR *'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('VENCIMENTO *'), { target: { value: '2026-08-10' } })

    const whatsappCheckbox = screen.getByRole('checkbox', { name: 'Enviar por WhatsApp' })
    expect(whatsappCheckbox).toBeChecked()
    fireEvent.click(whatsappCheckbox)
    expect(whatsappCheckbox).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'CRIAR COBRANÇA' }))

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        'unit-1',
        expect.objectContaining({ sendWhatsApp: false, generateLink: true, sendEmail: true }),
      ),
    )
  })

  it('shows the backend validation message when the submission is rejected as invalid_body', async () => {
    const listSpy = vi
      .spyOn(membersApi, 'listMembers')
      .mockResolvedValue({ ok: true, members: [student()] })
    vi.spyOn(invoicesApi, 'createInvoice').mockResolvedValue({
      ok: false,
      status: 422,
      error: 'invalid_body',
      message: 'Valor deve ser maior que zero.',
    })

    renderPage()
    await selectStudent(listSpy)

    fireEvent.click(screen.getByRole('button', { name: 'Avulso' }))
    fireEvent.change(screen.getByLabelText('DESCRIÇÃO *'), { target: { value: 'Aula extra' } })
    fireEvent.change(screen.getByLabelText('VALOR *'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('VENCIMENTO *'), { target: { value: '2026-08-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'CRIAR COBRANÇA' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Valor deve ser maior que zero.')
  })
})
