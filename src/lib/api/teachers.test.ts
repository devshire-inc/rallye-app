import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getTeacher, listTeachers } from './teachers'

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
