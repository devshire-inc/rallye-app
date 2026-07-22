// Cliente HTTP da Central de Pendências (BEAC-1890/1891/1893/1894, story
// BEAC-1703) — GET /units/{id}/pending-approvals (rallye-api/api/internal/
// pendingapprovals/handler.go), PATCH /teacher-block-requests/{id}
// (rallye-api/api/internal/blockdecisions/handler.go) e PATCH
// /reschedule-credits/{id} (rallye-api/api/internal/reschedule/
// decision_handler.go — endpoint adicionado nesta mesma dispatch, gap
// encontrado ao construir o card: nenhuma task original previa um endpoint
// de decisão para type=reschedule, mas o AC do card pede "Aprovar"/
// "Recusar" também para esses itens).
import { apiFetch } from '../httpClient'

export type PendingApprovalType = 'teacher_block' | 'reschedule'
export type PendingApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface TeacherBlockDetail {
  teacherId: string
  teacherName: string
  startDate: string
  endDate: string
  reason: string
}

export interface RescheduleDetail {
  studentId: string
  studentName: string
  targetClassName: string | null
  targetStartAt: string | null
}

export interface PendingApprovalItem {
  id: string
  type: PendingApprovalType
  status: PendingApprovalStatus
  requestedBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  teacherBlock: TeacherBlockDetail | null
  reschedule: RescheduleDetail | null
}

type TeacherBlockDetailWire = {
  teacher_id: string
  teacher_name: string
  start_date: string
  end_date: string
  reason: string
}

type RescheduleDetailWire = {
  student_id: string
  student_name: string
  target_class_name: string | null
  target_start_at: string | null
}

type PendingApprovalItemWire = {
  id: string
  type: PendingApprovalType
  status: PendingApprovalStatus
  requested_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  teacher_block?: TeacherBlockDetailWire | null
  reschedule?: RescheduleDetailWire | null
}

function fromWire(wire: PendingApprovalItemWire): PendingApprovalItem {
  return {
    id: wire.id,
    type: wire.type,
    status: wire.status,
    requestedBy: wire.requested_by,
    reviewedBy: wire.reviewed_by,
    reviewedAt: wire.reviewed_at,
    createdAt: wire.created_at,
    teacherBlock: wire.teacher_block
      ? {
          teacherId: wire.teacher_block.teacher_id,
          teacherName: wire.teacher_block.teacher_name,
          startDate: wire.teacher_block.start_date,
          endDate: wire.teacher_block.end_date,
          reason: wire.teacher_block.reason,
        }
      : null,
    reschedule: wire.reschedule
      ? {
          studentId: wire.reschedule.student_id,
          studentName: wire.reschedule.student_name,
          targetClassName: wire.reschedule.target_class_name,
          targetStartAt: wire.reschedule.target_start_at,
        }
      : null,
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error', message: body.message }
}

export interface ListPendingApprovalsSuccess {
  ok: true
  items: PendingApprovalItem[]
}

export type ListPendingApprovalsResult = ListPendingApprovalsSuccess | ApiFailure

/** GET /units/{id}/pending-approvals(?status=pending). */
export async function listPendingApprovals(
  unitId: string,
  status?: PendingApprovalStatus,
): Promise<ListPendingApprovalsResult> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/pending-approvals${query}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as PendingApprovalItemWire[]
  return { ok: true, items: body.map(fromWire) }
}

export type BlockRequestDecision = 'approve_cancel' | 'approve_substitute' | 'reject'

export interface DecideBlockRequestSuccess {
  ok: true
  status: string
  affectedBookings: number
  creditsGranted: number
}

export type DecideBlockRequestResult = DecideBlockRequestSuccess | ApiFailure

/** PATCH /teacher-block-requests/{id}. */
export async function decideTeacherBlockRequest(
  blockRequestId: string,
  decision: BlockRequestDecision,
  substituteTeacherId?: string,
): Promise<DecideBlockRequestResult> {
  const response = await apiFetch(`/teacher-block-requests/${encodeURIComponent(blockRequestId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      decision,
      substitute_teacher_id: substituteTeacherId,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    status: string
    affected_bookings: number
    credits_granted: number
  }
  return {
    ok: true,
    status: body.status,
    affectedBookings: body.affected_bookings,
    creditsGranted: body.credits_granted,
  }
}

export type RescheduleCreditDecision = 'approve' | 'reject'

export interface DecideRescheduleCreditSuccess {
  ok: true
  status: string
}

export type DecideRescheduleCreditResult = DecideRescheduleCreditSuccess | ApiFailure

/** PATCH /reschedule-credits/{id}. */
export async function decideRescheduleCredit(
  creditId: string,
  decision: RescheduleCreditDecision,
): Promise<DecideRescheduleCreditResult> {
  const response = await apiFetch(`/reschedule-credits/${encodeURIComponent(creditId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { status: string }
  return { ok: true, status: body.status }
}
