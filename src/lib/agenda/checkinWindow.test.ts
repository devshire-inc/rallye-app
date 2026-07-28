import { describe, expect, it } from 'vitest'
import { isWithinCheckinWindow, rowState } from './checkinWindow'

describe('isWithinCheckinWindow', () => {
  it('is false more than 15 minutes before start', () => {
    const start = '2026-07-28T14:00:00Z'
    const now = new Date('2026-07-28T13:44:00Z')
    expect(isWithinCheckinWindow(now, start)).toBe(false)
  })

  it('is true exactly 15 minutes before start', () => {
    const start = '2026-07-28T14:00:00Z'
    const now = new Date('2026-07-28T13:45:00Z')
    expect(isWithinCheckinWindow(now, start)).toBe(true)
  })

  it('is true exactly 30 minutes after start', () => {
    const start = '2026-07-28T14:00:00Z'
    const now = new Date('2026-07-28T14:30:00Z')
    expect(isWithinCheckinWindow(now, start)).toBe(true)
  })

  it('is false more than 30 minutes after start', () => {
    const start = '2026-07-28T14:00:00Z'
    const now = new Date('2026-07-28T14:31:00Z')
    expect(isWithinCheckinWindow(now, start)).toBe(false)
  })
})

describe('rowState', () => {
  it('is done when checkedIn is true, regardless of window', () => {
    const now = new Date('2026-07-28T09:00:00Z')
    expect(rowState(now, { checkedIn: true, startAt: '2026-07-28T14:00:00Z' })).toBe('done')
  })

  it('is available when within the check-in window and not checked in', () => {
    const now = new Date('2026-07-28T13:50:00Z')
    expect(rowState(now, { checkedIn: false, startAt: '2026-07-28T14:00:00Z' })).toBe('available')
  })

  it('is future when before the window and not checked in', () => {
    const now = new Date('2026-07-28T10:00:00Z')
    expect(rowState(now, { checkedIn: false, startAt: '2026-07-28T14:00:00Z' })).toBe('future')
  })

  it('is available when past a class that is now outside the window, not checked in (retroactive check-in still accepted by the backend)', () => {
    const now = new Date('2026-07-28T16:00:00Z')
    expect(rowState(now, { checkedIn: false, startAt: '2026-07-28T14:00:00Z' })).toBe('available')
  })
})
