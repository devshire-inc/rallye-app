import { screen, waitFor } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as studentsApi from '../../lib/api/students'
import * as usePermissionModule from '../../hooks/usePermission'
import NewStudentPage from './NewStudentPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermission(allowed: boolean) {
  vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue(allowed)
}

function renderPage(unitId = 'unit-1') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/units/${unitId}/students/new`]}>
      <Routes>
        <Route path="/units/:unitId/students/new" element={<NewStudentPage />} />
        <Route path="/dashboard" element={<div>Dashboard placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nome completo/i), 'Aluno Teste')
  await user.type(screen.getByLabelText(/^e-mail$/i), 'aluno@example.com')
}

describe('NewStudentPage — permissão (esconder sempre, nunca desabilitar)', () => {
  it('não renderiza o formulário quando o usuário não tem alunos:write', () => {
    mockPermission(false)
    renderPage()

    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/não tem permissão/i)
  })
})

describe('NewStudentPage — validação client-side', () => {
  it('exige nome e e-mail antes de chamar a API', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(studentsApi, 'createStudent')
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/nome completo é obrigatório/i)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('exige responsável legal quando a data de nascimento indica menor de 18 anos', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(studentsApi, 'createStudent')
    const user = userEvent.setup()
    renderPage()

    await fillRequiredFields(user)
    await user.type(screen.getByLabelText(/data de nascimento/i), '2015-01-01')
    // Sem responsável legal preenchido.
    await user.click(screen.getByRole('checkbox', { name: /enviar convite por e-mail/i }))
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/responsável legal/i)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('não exige responsável legal para aluno maior de idade', async () => {
    mockPermission(true)
    vi.spyOn(studentsApi, 'createStudent').mockResolvedValue({
      ok: true,
      kind: 'created',
      studentId: 'student-1',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    const user = userEvent.setup()
    renderPage()

    await fillRequiredFields(user)
    await user.type(screen.getByLabelText(/data de nascimento/i), '1990-01-01')

    expect(screen.queryByText(/responsável legal \(obrigatório/i)).not.toBeInTheDocument()
  })

  it('exige ao menos um canal de convite marcado', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(studentsApi, 'createStudent')
    const user = userEvent.setup()
    renderPage()

    await fillRequiredFields(user)
    // Desmarca o e-mail (vem marcado por padrão) sem marcar whatsapp.
    await user.click(screen.getByRole('checkbox', { name: /enviar convite por e-mail/i }))
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/selecione ao menos um canal/i)
    expect(createSpy).not.toHaveBeenCalled()
  })
})

describe('NewStudentPage — cadastro com e-mail novo (cenário 1)', () => {
  it('envia o guardian quando o aluno é menor e navega para o dashboard no sucesso', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(studentsApi, 'createStudent').mockResolvedValue({
      ok: true,
      kind: 'created',
      studentId: 'student-1',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    const user = userEvent.setup()
    renderPage('unit-42')

    await fillRequiredFields(user)
    await user.type(screen.getByLabelText(/data de nascimento/i), '2015-01-01')
    await user.type(screen.getByLabelText(/nome do responsável/i), 'Mãe do Aluno')
    await user.type(screen.getByLabelText(/telefone do responsável/i), '+5521999990000')
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    const [unitId, payload] = createSpy.mock.calls[0]
    expect(unitId).toBe('unit-42')
    expect(payload.guardian).toEqual({
      nome: 'Mãe do Aluno',
      telefone: '+5521999990000',
      cpf: undefined,
    })
    expect(payload.confirmExistingAccount).toBe(false)

    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
  })

  it('envia o CPF do responsável (não o CPF do próprio aluno) em guardian.cpf', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(studentsApi, 'createStudent').mockResolvedValue({
      ok: true,
      kind: 'created',
      studentId: 'student-1',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    const user = userEvent.setup()
    renderPage('unit-42')

    await fillRequiredFields(user)
    await user.type(screen.getByLabelText(/data de nascimento/i), '2015-01-01')
    await user.type(screen.getByLabelText(/^cpf$/i), '111.111.111-11')
    await user.type(screen.getByLabelText(/nome do responsável/i), 'Mãe do Aluno')
    await user.type(screen.getByLabelText(/telefone do responsável/i), '+5521999990000')
    await user.type(screen.getByLabelText(/cpf do responsável/i), '222.222.222-22')
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    const [, payload] = createSpy.mock.calls[0]
    expect(payload.cpf).toBe('111.111.111-11')
    expect(payload.guardian?.cpf).toBe('222.222.222-22')
  })
})

describe('NewStudentPage — e-mail já existente (cenários 2 e 3)', () => {
  it('mostra o banner "conta já existe" e, ao confirmar, reenvia com confirmExistingAccount=true', async () => {
    mockPermission(true)
    const createSpy = vi
      .spyOn(studentsApi, 'createStudent')
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        error: 'account_exists',
        message: 'Já existe uma conta com este e-mail.',
        email: 'aluno@example.com',
      })
      .mockResolvedValueOnce({ ok: true, kind: 'membership_created', email: 'aluno@example.com' })
    const user = userEvent.setup()
    renderPage()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByText(/já existe uma conta/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /vincular a esta arena/i }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2))
    expect(createSpy.mock.calls[1][1].confirmExistingAccount).toBe(true)
    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
  })

  it('bloqueia com erro claro quando o e-mail já está cadastrado (membership ativa)', async () => {
    mockPermission(true)
    vi.spyOn(studentsApi, 'createStudent').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'already_registered',
      message: 'Este e-mail já está cadastrado nesta unidade',
    })
    const user = userEvent.setup()
    renderPage()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/já está cadastrado nesta unidade/i)
    expect(screen.queryByRole('button', { name: /vincular a esta arena/i })).not.toBeInTheDocument()
  })
})
