import { describe, expect, it } from 'vitest'
import { resolveNotificationRoute } from './notificationRouting'

describe('resolveNotificationRoute', () => {
  it('resolves invoice to /invoices/:id', () => {
    expect(resolveNotificationRoute('invoice', 'inv-1')).toBe('/invoices/inv-1')
  })

  it('returns null for reference types that need params the notification does not carry', () => {
    expect(resolveNotificationRoute('booking', 'booking-1')).toBeNull()
    expect(resolveNotificationRoute('tournament_match', 'match-1')).toBeNull()
    expect(resolveNotificationRoute('pending_approval', 'pa-1')).toBeNull()
  })

  it('returns null when reference_type or reference_id is missing', () => {
    expect(resolveNotificationRoute(null, 'x')).toBeNull()
    expect(resolveNotificationRoute('invoice', null)).toBeNull()
    expect(resolveNotificationRoute(undefined, undefined)).toBeNull()
  })
})
