import { describe, expect, it } from 'vitest'
import { groupNotificationsByRecency, notificationGroupLabel } from './groupNotifications'

const NOW = new Date('2026-07-23T18:00:00')

describe('notificationGroupLabel', () => {
  it('classifies a timestamp from today as "Hoje"', () => {
    expect(notificationGroupLabel('2026-07-23T09:14:00', NOW)).toBe('Hoje')
  })

  it('classifies a timestamp from yesterday as "Ontem"', () => {
    expect(notificationGroupLabel('2026-07-22T16:40:00', NOW)).toBe('Ontem')
  })

  it('classifies a timestamp from 3 days ago as "Esta semana"', () => {
    expect(notificationGroupLabel('2026-07-20T11:00:00', NOW)).toBe('Esta semana')
  })

  it('classifies a timestamp exactly 7 days before today as "Mais antigas"', () => {
    expect(notificationGroupLabel('2026-07-16T11:00:00', NOW)).toBe('Mais antigas')
  })

  it('classifies a timestamp from a month ago as "Mais antigas"', () => {
    expect(notificationGroupLabel('2026-06-23T11:00:00', NOW)).toBe('Mais antigas')
  })
})

describe('groupNotificationsByRecency', () => {
  it('buckets items into ordered, non-empty groups, preserving each item\'s relative order', () => {
    const items = [
      { id: '1', createdAt: '2026-07-23T09:00:00' }, // Hoje
      { id: '2', createdAt: '2026-07-23T08:00:00' }, // Hoje
      { id: '3', createdAt: '2026-07-22T10:00:00' }, // Ontem
      { id: '4', createdAt: '2026-06-01T10:00:00' }, // Mais antigas
    ]

    const groups = groupNotificationsByRecency(items, NOW)

    expect(groups).toEqual([
      { label: 'Hoje', items: [items[0], items[1]] },
      { label: 'Ontem', items: [items[2]] },
      { label: 'Mais antigas', items: [items[3]] },
    ])
  })

  it('omits groups with no items (e.g. no "Esta semana" entry when nothing falls there)', () => {
    const items = [{ id: '1', createdAt: '2026-07-23T09:00:00' }]

    const groups = groupNotificationsByRecency(items, NOW)

    expect(groups.map((g) => g.label)).toEqual(['Hoje'])
  })

  it('returns an empty array for an empty list', () => {
    expect(groupNotificationsByRecency([], NOW)).toEqual([])
  })
})
