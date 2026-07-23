// Cliente HTTP de POST /classes/{id}/enrollments — BEAC-1862 (story
// BEAC-1692 "Matrícula aluno-turma"), endpoint já implementado no backend
// antes desta task (rallye-api-beac1693/api/internal/enrollments/handler.go,
// lido diretamente antes de escrever este cliente) — reaproveitado aqui pelo
// botão "Adicionar a turma" da aba Turmas de AL2 (BEAC-1864,
// ClassHistorySection.tsx), não um novo endpoint inventado por esta task.
//
// Contrato real:
//   - POST /classes/{id}/enrollments, body { student_id } -> 201 com { id,
//     class_id, student_id, student_name?, enrolled_at, status,
//     capacity_warning }.
//   - 409 `already_enrolled` quando o aluno já está matriculado nesta turma
//     (UNIQUE(student_id, class_id), migrations/000036).
//   - `capacity_warning: true` quando a matrícula ultrapassa
//     classes.capacity — "avisa, não bloqueia" (mesmo padrão de
//     POST /bookings/{id}/participants, ../api/bookings.ts): a matrícula JÁ
//     foi criada quando este campo vem true, não é uma confirmação pendente.
//   - Exige permission write em 'alunos' E 'agenda' ao mesmo tempo
//     (interseção, ver comentário de pacote do handler real) — a UI que
//     mostra o botão precisa checar as duas.
import { apiFetch } from '../httpClient'

export interface Enrollment {
  id: string
  classId: string
  studentId: string
  studentName: string | null
  enrolledAt: string
  status: string
  capacityWarning: boolean
}

type EnrollmentWire = {
  id: string
  class_id: string
  student_id: string
  student_name?: string
  enrolled_at: string
  status: string
  capacity_warning: boolean
}

function fromWire(wire: EnrollmentWire): Enrollment {
  return {
    id: wire.id,
    classId: wire.class_id,
    studentId: wire.student_id,
    studentName: wire.student_name ?? null,
    enrolledAt: wire.enrolled_at,
    status: wire.status,
    capacityWarning: wire.capacity_warning,
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}

export interface CreateEnrollmentSuccess {
  ok: true
  enrollment: Enrollment
}

export type CreateEnrollmentResult = CreateEnrollmentSuccess | ApiFailure

/** POST /classes/{id}/enrollments — matricula `studentId` na turma `classId`. */
export async function createEnrollment(
  classId: string,
  studentId: string,
): Promise<CreateEnrollmentResult> {
  const response = await apiFetch(`/classes/${encodeURIComponent(classId)}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as EnrollmentWire
  return { ok: true, enrollment: fromWire(body) }
}
