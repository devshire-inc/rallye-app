// Cliente HTTP de GET /students/{id}/class-history — BEAC-1863 (story
// BEAC-1693), consumido pela aba "Turmas" de AL2 (BEAC-1864,
// ClassHistorySection.tsx). Contrato lido diretamente do handler REAL (não da
// paráfrase da task) em
// rallye-api-beac1693/api/internal/classhistory/handler.go antes de escrever
// este cliente:
//
//   - GET /students/{id}/class-history -> { class_history: [{ enrollment_id,
//     class_id, class_name, sport, rrule, start_time, end_time, teacher_id,
//     teacher_name, enrolled_at, status }, ...] } — resposta é um OBJETO com
//     a chave `class_history` (não um array bruto, ao contrário de GET
//     /units/{id}/classes em ../api/classes.ts), ordenado por enrolled_at
//     DESC (mais recente primeiro) pelo próprio backend.
//   - `status`: 'active' | 'ended' — valores em inglês, sem tradução no wire
//     (mesma convenção de students.status/teachers.status); a tradução para
//     português é responsabilidade da UI.
//   - Leitura do próprio histórico sempre liberada ao aluno (bypass total,
//     sem exigir alunos:read); staff precisa de alunos:read, senão 403.
//
// Nota: rota NÃO é unit-scoped (`/students/{id}/...`), mesma forma de
// ../api/skillLevels.ts.
import { apiFetch } from '../httpClient'

export type ClassHistoryStatus = 'active' | 'ended'

export interface ClassHistoryItem {
  enrollmentId: string
  classId: string
  className: string
  sport: string
  rrule: string
  startTime: string
  endTime: string
  teacherId: string
  teacherName: string
  enrolledAt: string
  status: ClassHistoryStatus
}

type ClassHistoryItemWire = {
  enrollment_id: string
  class_id: string
  class_name: string
  sport: string
  rrule: string
  start_time: string
  end_time: string
  teacher_id: string
  teacher_name: string
  enrolled_at: string
  status: ClassHistoryStatus
}

function fromWire(wire: ClassHistoryItemWire): ClassHistoryItem {
  return {
    enrollmentId: wire.enrollment_id,
    classId: wire.class_id,
    className: wire.class_name,
    sport: wire.sport,
    rrule: wire.rrule,
    startTime: wire.start_time,
    endTime: wire.end_time,
    teacherId: wire.teacher_id,
    teacherName: wire.teacher_name,
    enrolledAt: wire.enrolled_at,
    status: wire.status,
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

export interface ListClassHistorySuccess {
  ok: true
  classHistory: ClassHistoryItem[]
}

export type ListClassHistoryResult = ListClassHistorySuccess | ApiFailure

/** GET /students/{id}/class-history. */
export async function listClassHistory(studentId: string): Promise<ListClassHistoryResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/class-history`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { class_history: ClassHistoryItemWire[] }
  return { ok: true, classHistory: body.class_history.map(fromWire) }
}
