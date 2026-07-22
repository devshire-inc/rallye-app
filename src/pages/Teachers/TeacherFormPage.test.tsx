import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as availabilityApi from '../../lib/api/availability'
import * as remunerationApi from '../../lib/api/remuneration'
import * as teachersApi from '../../lib/api/teachers'
import type { Teacher } from '../../lib/api/teachers'
import * as usePermissionModule from '../../hooks/usePermission'
import TeacherFormPage from './TeacherFormPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermission(allowed: boolean) {
  vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue(allowed)
}

function teacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: 'teacher-1',
    fullName: 'Marcus Lima',
    email: 'marcus@teste.com',
    phone: '+5521999990000',
    sports: ['beach_tennis'],
    remunerationModel: 'per_class',
    remunerationValue: 80,
    certifications: null,
    bio: null,
    status: 'active',
    ...overrides,
  }
}

function renderCreatePage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/teachers/new`]}>
      <Routes>
        <Route path="/units/:unitId/teachers/new" element={<TeacherFormPage />} />
        <Route path="/units/:unitId/teachers" element={<div>Lista de professores placeholder</div>} />
        <Route
          path="/units/:unitId/teachers/:teacherId"
          element={<div>Perfil do professor placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(unitId = 'unit-1', teacherId = 'teacher-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/teachers/${teacherId}/edit`]}>
      <Routes>
        <Route path="/units/:unitId/teachers/:teacherId/edit" element={<TeacherFormPage />} />
        <Route
          path="/units/:unitId/teachers/:teacherId"
          element={<div>Perfil do professor placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeacherFormPage — permissão (esconder sempre, nunca desabilitar)', () => {
  it('não renderiza o formulário de criação sem professores:write', () => {
    mockPermission(false)
    renderCreatePage()

    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/não tem permissão/i)
  })

  it('não renderiza o formulário de edição sem professores:write', () => {
    mockPermission(false)
    vi.spyOn(teachersApi, 'getTeacher').mockReturnValue(new Promise(() => {}))
    vi.spyOn(availabilityApi, 'getAvailability').mockReturnValue(new Promise(() => {}))
    renderEditPage()

    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/não tem permissão/i)
  })
})

describe('TeacherFormPage — validação client-side (modo criar)', () => {
  it('exige nome, e-mail, telefone, esportes e remuneração antes de chamar a API', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(teachersApi, 'createTeacher')
    const user = userEvent.setup()
    renderCreatePage()

    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/nome completo é obrigatório/i)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('exige ao menos uma faixa de disponibilidade marcada', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(teachersApi, 'createTeacher')
    const user = userEvent.setup()
    renderCreatePage()

    await user.type(screen.getByLabelText(/nome completo/i), 'Professor Teste')
    await user.type(screen.getByLabelText(/^e-mail$/i), 'professor@example.com')
    await user.type(screen.getByLabelText(/telefone/i), '+5521999990000')
    await user.click(screen.getByRole('button', { name: 'Beach tennis' }))
    const valueInput = screen.getAllByRole('spinbutton')[0]
    await user.type(valueInput, '80')

    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/faixa de disponibilidade/i)
    expect(createSpy).not.toHaveBeenCalled()
  })
})

describe('TeacherFormPage — criação (POST /units/{id}/teachers)', () => {
  it('cria o professor, envia a disponibilidade marcada em batch e navega para o perfil', async () => {
    mockPermission(true)
    const createSpy = vi.spyOn(teachersApi, 'createTeacher').mockResolvedValue({
      ok: true,
      kind: 'created',
      teacherId: 'teacher-novo',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    const patchAvailSpy = vi.spyOn(availabilityApi, 'patchAvailability').mockResolvedValue({
      ok: true,
      availability: [],
    })
    const user = userEvent.setup()
    renderCreatePage()

    await user.type(screen.getByLabelText(/nome completo/i), 'Professor Teste')
    await user.type(screen.getByLabelText(/^e-mail$/i), 'professor@example.com')
    await user.type(screen.getByLabelText(/telefone/i), '+5521999990000')
    await user.click(screen.getByRole('button', { name: 'Beach tennis' }))
    const valueInput = screen.getAllByRole('spinbutton')[0]
    await user.type(valueInput, '3000')
    await user.click(screen.getByRole('button', { name: 'Seg 08-10' }))

    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))

    expect(await screen.findByText('Perfil do professor placeholder')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledWith(
      'unit-1',
      expect.objectContaining({
        fullName: 'Professor Teste',
        email: 'professor@example.com',
        phone: '+5521999990000',
        remunerationModel: 'fixed',
        remunerationValue: 3000,
        sports: ['beach_tennis'],
      }),
    )
    expect(patchAvailSpy).toHaveBeenCalledWith('teacher-novo', [
      { dayOfWeek: 1, timeSlot: '08-10', available: true },
    ])
  })

  it('mostra o banner account_exists e vincula ao confirmar', async () => {
    mockPermission(true)
    const createSpy = vi
      .spyOn(teachersApi, 'createTeacher')
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        error: 'account_exists',
        message: 'Já existe uma conta com este e-mail.',
        email: 'professor@example.com',
      })
      .mockResolvedValueOnce({ ok: true, kind: 'membership_created', email: 'professor@example.com' })
    const user = userEvent.setup()
    renderCreatePage()

    await user.type(screen.getByLabelText(/nome completo/i), 'Professor Teste')
    await user.type(screen.getByLabelText(/^e-mail$/i), 'professor@example.com')
    await user.type(screen.getByLabelText(/telefone/i), '+5521999990000')
    await user.click(screen.getByRole('button', { name: 'Beach tennis' }))
    const valueInput = screen.getAllByRole('spinbutton')[0]
    await user.type(valueInput, '3000')
    await user.click(screen.getByRole('button', { name: 'Seg 08-10' }))

    await user.click(screen.getByRole('button', { name: /cadastrar e convidar/i }))
    expect(await screen.findByText(/já existe uma conta/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /vincular a esta arena/i }))

    expect(await screen.findByText('Lista de professores placeholder')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledTimes(2)
  })
})

describe('TeacherFormPage — edição (PATCH /teachers/{id})', () => {
  it('pré-preenche os campos com os dados atuais e mantém o e-mail somente-leitura', async () => {
    mockPermission(true)
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(availabilityApi, 'getAvailability').mockResolvedValue({ ok: true, availability: [] })

    renderEditPage()

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/nome completo/i)
    expect(nameInput.value).toBe('Marcus Lima')
    const emailInput = screen.getByLabelText<HTMLInputElement>(/^e-mail$/i)
    expect(emailInput.value).toBe('marcus@teste.com')
    expect(emailInput).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Beach tennis' })).toHaveClass('active')
  })

  it('salva via PATCH /teachers/{id} e PATCH /teachers/{id}/remuneration, depois navega para o perfil', async () => {
    mockPermission(true)
    vi.spyOn(teachersApi, 'getTeacher').mockResolvedValue({ ok: true, teacher: teacher() })
    vi.spyOn(availabilityApi, 'getAvailability').mockResolvedValue({ ok: true, availability: [] })
    const patchSpy = vi.spyOn(teachersApi, 'patchTeacher').mockResolvedValue({
      ok: true,
      teacher: teacher({ fullName: 'Marcus Editado' }),
    })
    const remunerationSpy = vi.spyOn(remunerationApi, 'patchRemuneration').mockResolvedValue({
      ok: true,
      remunerationModel: 'per_class',
      remunerationValue: 80,
      historyRowCreated: false,
    })

    const user = userEvent.setup()
    renderEditPage()

    const nameInput = await screen.findByLabelText(/nome completo/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Marcus Editado')

    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    expect(await screen.findByText('Perfil do professor placeholder')).toBeInTheDocument()
    expect(patchSpy).toHaveBeenCalledWith(
      'teacher-1',
      expect.objectContaining({ fullName: 'Marcus Editado', sports: ['beach_tennis'] }),
    )
    expect(remunerationSpy).toHaveBeenCalledWith('teacher-1', {
      remunerationModel: 'per_class',
      remunerationValue: 80,
    })
  })
})
