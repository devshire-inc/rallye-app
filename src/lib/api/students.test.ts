import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createStudent, getStudent } from './students'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to /units/{id}/students with the mapped snake_case body', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { student_id: 'student-1', status: 'pending', invite_sent_via: ['email'] }),
    )

    const result = await createStudent('unit-1', {
      fullName: 'Aluno Teste',
      email: 'aluno@example.com',
      phone: '+5521999990000',
      inviteChannels: { email: true, whatsapp: false },
    })

    expect(result).toEqual({
      ok: true,
      kind: 'created',
      studentId: 'student-1',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/students',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      full_name: 'Aluno Teste',
      email: 'aluno@example.com',
      phone: '+5521999990000',
      birth_date: undefined,
      cpf: undefined,
      observations: undefined,
      guardian: undefined,
      invite_channels: { email: true, whatsapp: false },
      confirm_existing_account: false,
    })
  })

  it('includes the guardian object when provided (menor de idade)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { student_id: 'student-2', status: 'pending', invite_sent_via: ['email'] }),
    )

    await createStudent('unit-1', {
      fullName: 'Aluno Menor',
      email: 'menor@example.com',
      birthDate: '2015-01-01',
      guardian: { nome: 'Mãe', telefone: '+5521999990000' },
      inviteChannels: { email: true, whatsapp: false },
    })

    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.birth_date).toBe('2015-01-01')
    expect(body.guardian).toEqual({ nome: 'Mãe', telefone: '+5521999990000', cpf: undefined })
  })

  it('returns kind=membership_created on 201 with membership_created=true', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, { membership_created: true, email: 'ja-existe@example.com' }))

    const result = await createStudent('unit-1', {
      fullName: 'Já Existe',
      email: 'ja-existe@example.com',
      inviteChannels: { email: false, whatsapp: false },
      confirmExistingAccount: true,
    })

    expect(result).toEqual({ ok: true, kind: 'membership_created', email: 'ja-existe@example.com' })
  })

  it('returns the account_exists signal on 409 without treating it as a hard failure banner', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'account_exists', message: 'Já existe uma conta.', email: 'x@example.com' }),
    )

    const result = await createStudent('unit-1', {
      fullName: 'X',
      email: 'x@example.com',
      inviteChannels: { email: false, whatsapp: false },
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'account_exists',
      message: 'Já existe uma conta.',
      email: 'x@example.com',
    })
  })

  it('returns already_registered on 409 for an active membership', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'already_registered', message: 'Este e-mail já está cadastrado nesta unidade' }),
    )

    const result = await createStudent('unit-1', {
      fullName: 'Y',
      email: 'y@example.com',
      inviteChannels: { email: false, whatsapp: false },
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'already_registered',
      message: 'Este e-mail já está cadastrado nesta unidade',
    })
  })

  it('returns ok=false on unexpected/non-JSON error responses without throwing', async () => {
    apiFetchMock.mockResolvedValue(new Response('not json', { status: 500 }))

    const result = await createStudent('unit-1', {
      fullName: 'Z',
      email: 'z@example.com',
      inviteChannels: { email: true, whatsapp: false },
    })

    expect(result).toEqual({ ok: false, status: 500, error: 'unknown_error', message: undefined })
  })
})

describe('getStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/students/{studentId} and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'student-1',
        full_name: 'Marina Costa',
        email: 'marina@teste.com',
        phone: '+5548991234567',
        birth_date: '1996-02-14',
        cpf: '111.111.111-11',
        observations: 'Lesão no ombro direito',
        status: 'active',
      }),
    )

    const result = await getStudent('unit-1', 'student-1')

    expect(result).toEqual({
      ok: true,
      student: {
        id: 'student-1',
        fullName: 'Marina Costa',
        email: 'marina@teste.com',
        phone: '+5548991234567',
        birthDate: '1996-02-14',
        cpf: '111.111.111-11',
        observations: 'Lesão no ombro direito',
        status: 'active',
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/students/student-1')
  })

  it('maps a failure response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'student_not_found' }))

    const result = await getStudent('unit-1', 'missing')

    expect(result).toEqual({ ok: false, status: 404, error: 'student_not_found' })
  })
})
