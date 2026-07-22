import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createTeacher, getTeacher, listTeachers, patchTeacher } from './teachers'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listTeachers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/teachers and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'teacher-1',
          full_name: 'Marcus Lima',
          email: 'marcus@teste.com',
          phone: '(48) 99876-5432',
          sports: ['beach_tennis', 'padel'],
          remuneration_model: 'commission',
          remuneration_value: 30,
          status: 'active',
          turmas_count: 5,
        },
      ]),
    )

    const result = await listTeachers('unit-1')

    expect(result).toEqual({
      ok: true,
      teachers: [
        {
          id: 'teacher-1',
          fullName: 'Marcus Lima',
          email: 'marcus@teste.com',
          phone: '(48) 99876-5432',
          sports: ['beach_tennis', 'padel'],
          remunerationModel: 'commission',
          remunerationValue: 30,
          status: 'active',
          turmasCount: 5,
        },
      ],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/teachers')
  })

  it('appends ?search= when provided', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, []))

    await listTeachers('unit-1', 'Marc')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/teachers?search=Marc')
  })

  it('does not append ?search= for an empty/blank query', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, []))

    await listTeachers('unit-1', '   ')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/teachers')
  })

  it('returns a failure result on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listTeachers('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('getTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /teachers/{id} and maps certifications/bio', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'teacher-1',
        full_name: 'Marcus Lima',
        email: 'marcus@teste.com',
        phone: null,
        sports: ['beach_tennis'],
        remuneration_model: 'per_class',
        remuneration_value: 80,
        certifications: 'CBT Nível 2',
        bio: 'Professor há 8 anos.',
        status: 'active',
      }),
    )

    const result = await getTeacher('teacher-1')

    expect(result).toEqual({
      ok: true,
      teacher: {
        id: 'teacher-1',
        fullName: 'Marcus Lima',
        email: 'marcus@teste.com',
        phone: null,
        sports: ['beach_tennis'],
        remunerationModel: 'per_class',
        remunerationValue: 80,
        certifications: 'CBT Nível 2',
        bio: 'Professor há 8 anos.',
        status: 'active',
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/teachers/teacher-1')
  })

  it('returns a failure result when the teacher is not found', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'teacher_not_found' }))

    const result = await getTeacher('missing')

    expect(result).toEqual({ ok: false, status: 404, error: 'teacher_not_found' })
  })
})

describe('createTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to /units/{id}/teachers with the mapped snake_case body', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { teacher_id: 'teacher-1', status: 'pending', invite_sent_via: ['email'] }),
    )

    const result = await createTeacher('unit-1', {
      fullName: 'Professor Teste',
      email: 'professor@example.com',
      phone: '+5521999990000',
      remunerationModel: 'commission',
      remunerationValue: 15.5,
      sports: ['beach_tennis', 'padel'],
      inviteChannels: { email: true, whatsapp: false },
    })

    expect(result).toEqual({
      ok: true,
      kind: 'created',
      teacherId: 'teacher-1',
      status: 'pending',
      inviteSentVia: ['email'],
    })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/teachers',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      full_name: 'Professor Teste',
      email: 'professor@example.com',
      phone: '+5521999990000',
      remuneration_model: 'commission',
      remuneration_value: 15.5,
      sports: ['beach_tennis', 'padel'],
      certifications: undefined,
      bio: undefined,
      invite_channels: { email: true, whatsapp: false },
      confirm_existing_account: false,
    })
  })

  it('returns kind=membership_created on 201 with membership_created=true', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, { membership_created: true, email: 'ja-existe@example.com' }),
    )

    const result = await createTeacher('unit-1', {
      fullName: 'Já Existe',
      email: 'ja-existe@example.com',
      remunerationModel: 'fixed',
      remunerationValue: 3000,
      sports: ['padel'],
      inviteChannels: { email: false, whatsapp: false },
      confirmExistingAccount: true,
    })

    expect(result).toEqual({ ok: true, kind: 'membership_created', email: 'ja-existe@example.com' })
  })

  it('returns the account_exists signal on 409 without treating it as a hard failure', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'account_exists', message: 'Já existe uma conta.', email: 'x@example.com' }),
    )

    const result = await createTeacher('unit-1', {
      fullName: 'X',
      email: 'x@example.com',
      remunerationModel: 'fixed',
      remunerationValue: 3000,
      sports: ['padel'],
      inviteChannels: { email: true, whatsapp: false },
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'account_exists',
      message: 'Já existe uma conta.',
      email: 'x@example.com',
    })
  })

  it('returns already_registered on 409 with that error', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'already_registered', message: 'Já cadastrado.' }),
    )

    const result = await createTeacher('unit-1', {
      fullName: 'X',
      email: 'x@example.com',
      remunerationModel: 'fixed',
      remunerationValue: 3000,
      sports: ['padel'],
      inviteChannels: { email: true, whatsapp: false },
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'already_registered',
      message: 'Já cadastrado.',
    })
  })
})

describe('patchTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /teachers/{id} with the mapped snake_case body and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'teacher-1',
        full_name: 'Marcus Editado',
        email: 'marcus@teste.com',
        phone: '+5521988887777',
        sports: ['beach_tennis', 'volei'],
        remuneration_model: 'per_class',
        remuneration_value: 80,
        certifications: 'CBT Nível 3',
        bio: 'Bio atualizada',
        status: 'active',
      }),
    )

    const result = await patchTeacher('teacher-1', {
      fullName: 'Marcus Editado',
      phone: '+5521988887777',
      sports: ['beach_tennis', 'volei'],
      certifications: 'CBT Nível 3',
      bio: 'Bio atualizada',
    })

    expect(result).toEqual({
      ok: true,
      teacher: {
        id: 'teacher-1',
        fullName: 'Marcus Editado',
        email: 'marcus@teste.com',
        phone: '+5521988887777',
        sports: ['beach_tennis', 'volei'],
        remunerationModel: 'per_class',
        remunerationValue: 80,
        certifications: 'CBT Nível 3',
        bio: 'Bio atualizada',
        status: 'active',
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teachers/teacher-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      full_name: 'Marcus Editado',
      phone: '+5521988887777',
      sports: ['beach_tennis', 'volei'],
      certifications: 'CBT Nível 3',
      bio: 'Bio atualizada',
    })
  })

  it('returns a failure result on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await patchTeacher('teacher-1', {
      fullName: 'X',
      sports: ['padel'],
    })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
