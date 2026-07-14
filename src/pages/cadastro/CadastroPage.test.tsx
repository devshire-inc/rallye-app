import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CadastroPage } from './CadastroPage'
import * as signupApi from '../../lib/api/signup'

vi.mock('../../lib/api/signup')

function renderCadastroPage() {
  return render(
    <MemoryRouter initialEntries={['/cadastro']}>
      <Routes>
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/verificacao-email" element={<div>Tela A4</div>} />
        <Route path="/login" element={<div>Tela A1</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'Fulano de Tal' } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'fulano@example.com' } })
  fireEvent.change(screen.getByLabelText(/telefone\/whatsapp/i), {
    target: { value: '11987654321' },
  })
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'senha1234' } })
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: 'senha1234' } })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('CadastroPage (A2)', () => {
  it('renders the Google/Apple buttons without OAuth wiring', () => {
    renderCadastroPage()
    expect(screen.getByRole('button', { name: /continuar com google/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /continuar com apple/i })).toBeDisabled()
  })

  it('keeps the CTA disabled until the form is fully valid', () => {
    renderCadastroPage()
    const cta = screen.getByRole('button', { name: /criar minha conta/i })
    expect(cta).toBeDisabled()

    fillValidForm()

    expect(cta).toBeEnabled()
  })

  it('shows an inline error for invalid email format', () => {
    renderCadastroPage()
    const emailInput = screen.getByLabelText(/e-mail/i)
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.blur(emailInput)

    expect(screen.getByText(/e-mail em formato inválido/i)).toBeInTheDocument()
  })

  it('shows a green check when password reaches 8 characters and a plain hint below that', () => {
    renderCadastroPage()
    const passwordInput = screen.getByLabelText(/^senha$/i)

    fireEvent.change(passwordInput, { target: { value: 'short' } })
    expect(screen.getByText(/mínimo de 8 caracteres/i)).not.toHaveClass('field-hint--ok')

    fireEvent.change(passwordInput, { target: { value: 'longenough1' } })
    expect(screen.getByText(/mínimo de 8 caracteres/i)).toHaveClass('field-hint--ok')
  })

  it('shows an inline error when confirm password does not match', () => {
    renderCadastroPage()
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'senha1234' } })
    const confirm = screen.getByLabelText(/confirmar senha/i)
    fireEvent.change(confirm, { target: { value: 'outrasenha' } })
    fireEvent.blur(confirm)

    expect(screen.getByText(/as senhas não coincidem/i)).toBeInTheDocument()
  })

  it('shows an inline error for invalid BR phone format', () => {
    renderCadastroPage()
    const phoneInput = screen.getByLabelText(/telefone\/whatsapp/i)
    fireEvent.change(phoneInput, { target: { value: '1132345678' } }) // landline, no mobile 9
    fireEvent.blur(phoneInput)

    expect(screen.getByText(/telefone em formato inválido/i)).toBeInTheDocument()
  })

  it('applies the (XX) XXXXX-XXXX mask as the user types the phone number', () => {
    renderCadastroPage()
    const phoneInput = screen.getByLabelText(/telefone\/whatsapp/i) as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '11987654321' } })

    expect(phoneInput.value).toBe('(11) 98765-4321')
  })

  it('navigates to /verificacao-email (A4) on successful signup', async () => {
    vi.mocked(signupApi.signup).mockResolvedValue({
      ok: true,
      userId: 'user-1',
      sessionToken: 'token-1',
    })

    renderCadastroPage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /criar minha conta/i }))

    await waitFor(() => expect(screen.getByText('Tela A4')).toBeInTheDocument())
  })

  it('shows "Este email já está cadastrado. Fazer login?" with a link to /login on 409', async () => {
    vi.mocked(signupApi.signup).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'email_already_registered',
    })

    renderCadastroPage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /criar minha conta/i }))

    expect(await screen.findByText(/este email já está cadastrado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fazer login\?/i })).toHaveAttribute('href', '/login')
  })
})
