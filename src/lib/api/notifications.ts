// Cliente HTTP da Central de Notificações (N1, BEAC-2021, story BEAC-1723) —
// rallye-api/api/internal/notifications/read_handler.go. Mesmo padrão de
// ./me.ts: usa apiFetch (não fetch cru), ApiFailure/failureFrom locais, tipos
// wire (snake_case) convertidos pra camelCase na borda.
import { apiFetch } from '../httpClient'

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

/** `type` é texto livre sem CHECK no backend (decisão travada da story) —
 * novos épicos podem adicionar tipos sem migration nova, então este campo
 * fica `string`, não uma union fechada. */
export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  referenceType: string | null
  referenceId: string | null
  readAt: string | null
  createdAt: string
}

type NotificationItemWire = {
  id: string
  type: string
  title: string
  body: string
  reference_type: string | null
  reference_id: string | null
  read_at: string | null
  created_at: string
}

function fromWire(wire: NotificationItemWire): NotificationItem {
  return {
    id: wire.id,
    type: wire.type,
    title: wire.title,
    body: wire.body,
    referenceType: wire.reference_type,
    referenceId: wire.reference_id,
    readAt: wire.read_at,
    createdAt: wire.created_at,
  }
}

export interface ListNotificationsSuccess {
  ok: true
  notifications: NotificationItem[]
  hasMore: boolean
}

export type ListNotificationsResult = ListNotificationsSuccess | ApiFailure

/** GET /me/notifications — lista plana, created_at DESC; o agrupamento
 * visual "Hoje/Ontem/Esta semana/Mais antigas" é client-side (ver
 * ../groupNotifications.ts), o backend não agrupa. */
export async function listNotifications(
  params: { limit?: number; offset?: number } = {},
): Promise<ListNotificationsResult> {
  const query = new URLSearchParams()
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()

  const response = await apiFetch(`/me/notifications${qs ? `?${qs}` : ''}`)
  if (!response.ok) return failureFrom(response)

  const wire = (await response.json()) as { notifications: NotificationItemWire[]; has_more: boolean }
  return { ok: true, notifications: wire.notifications.map(fromWire), hasMore: wire.has_more }
}

export interface MarkNotificationReadSuccess {
  ok: true
}

export type MarkNotificationReadResult = MarkNotificationReadSuccess | ApiFailure

/** POST /me/notifications/{id}/read — idempotente, 204 No Content. */
export async function markNotificationRead(id: string): Promise<MarkNotificationReadResult> {
  const response = await apiFetch(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
  if (!response.ok) return failureFrom(response)
  return { ok: true }
}

export interface MarkAllNotificationsReadSuccess {
  ok: true
  marked: number
}

export type MarkAllNotificationsReadResult = MarkAllNotificationsReadSuccess | ApiFailure

/** POST /me/notifications/mark-all-read — marca como lidas todas as
 * notificações visíveis (janela de 30 dias) do usuário. */
export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  const response = await apiFetch('/me/notifications/mark-all-read', { method: 'POST' })
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { marked: number }
  return { ok: true, marked: body.marked }
}

export interface GetUnreadNotificationCountSuccess {
  ok: true
  unreadCount: number
}

export type GetUnreadNotificationCountResult = GetUnreadNotificationCountSuccess | ApiFailure

/** GET /me/notifications/unread-count — alimenta o badge do sino no header. */
export async function getUnreadNotificationCount(): Promise<GetUnreadNotificationCountResult> {
  const response = await apiFetch('/me/notifications/unread-count')
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { unread_count: number }
  return { ok: true, unreadCount: body.unread_count }
}
