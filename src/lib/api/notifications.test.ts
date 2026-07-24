import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listNotifications', () => {
  it('GETs /me/notifications with no query when no params given, mapping wire snake_case to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        notifications: [
          {
            id: 'notif-1',
            type: 'aula_lembrete',
            title: 'Aula em 1h',
            body: 'Sua aula de Beach Tennis começa às 18h',
            reference_type: 'booking',
            reference_id: 'booking-1',
            read_at: null,
            created_at: '2026-07-23T10:00:00Z',
          },
        ],
        has_more: true,
      }),
    )

    const result = await listNotifications()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notifications')
    expect(result).toEqual({
      ok: true,
      notifications: [
        {
          id: 'notif-1',
          type: 'aula_lembrete',
          title: 'Aula em 1h',
          body: 'Sua aula de Beach Tennis começa às 18h',
          referenceType: 'booking',
          referenceId: 'booking-1',
          readAt: null,
          createdAt: '2026-07-23T10:00:00Z',
        },
      ],
      hasMore: true,
    })
  })

  it('appends limit/offset as query params when given', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { notifications: [], has_more: false }))

    await listNotifications({ limit: 20, offset: 40 })

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notifications?limit=20&offset=40')
  })

  it('returns an ApiFailure on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(500, { error: 'notifications_list_failed' }))

    const result = await listNotifications()

    expect(result).toEqual({ ok: false, status: 500, error: 'notifications_list_failed', message: undefined })
  })
})

describe('markNotificationRead', () => {
  it('POSTs /me/notifications/{id}/read and resolves ok on 204', async () => {
    apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    const result = await markNotificationRead('notif-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notifications/notif-1/read', { method: 'POST' })
    expect(result).toEqual({ ok: true })
  })

  it('returns an ApiFailure on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'notification_not_found' }))

    const result = await markNotificationRead('missing')

    expect(result).toEqual({ ok: false, status: 404, error: 'notification_not_found', message: undefined })
  })
})

describe('markAllNotificationsRead', () => {
  it('POSTs /me/notifications/mark-all-read and returns the marked count', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { marked: 7 }))

    const result = await markAllNotificationsRead()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notifications/mark-all-read', { method: 'POST' })
    expect(result).toEqual({ ok: true, marked: 7 })
  })
})

describe('getUnreadNotificationCount', () => {
  it('GETs /me/notifications/unread-count and returns the count', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { unread_count: 3 }))

    const result = await getUnreadNotificationCount()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notifications/unread-count')
    expect(result).toEqual({ ok: true, unreadCount: 3 })
  })

  it('returns an ApiFailure on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }))

    const result = await getUnreadNotificationCount()

    expect(result).toEqual({ ok: false, status: 401, error: 'unauthorized', message: undefined })
  })
})
