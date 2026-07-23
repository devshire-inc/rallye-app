import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTournamentLive } from './useTournamentLive'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  withCredentials: boolean
  closed = false
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {}

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url
    this.withCredentials = init?.withCredentials ?? false
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners[type] ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent)
    }
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useTournamentLive', () => {
  it('opens an EventSource pointed at /tournaments/{id}/live with credentials', () => {
    renderHook(() => useTournamentLive('tournament-1', vi.fn()))

    expect(MockEventSource.instances).toHaveLength(1)
    const source = MockEventSource.instances[0]
    expect(source.url).toContain('/tournaments/tournament-1/live')
    expect(source.withCredentials).toBe(true)
  })

  it('calls onMatchChanged with the match id from a match_changed event', () => {
    const onMatchChanged = vi.fn()
    renderHook(() => useTournamentLive('tournament-1', onMatchChanged))

    const source = MockEventSource.instances[0]
    source.emit('match_changed', { tournament_id: 'tournament-1', match_id: 'match-9' })

    expect(onMatchChanged).toHaveBeenCalledWith('match-9')
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useTournamentLive('tournament-1', vi.fn()))

    const source = MockEventSource.instances[0]
    unmount()

    expect(source.closed).toBe(true)
  })

  it('does not open a connection when tournamentId is undefined', () => {
    renderHook(() => useTournamentLive(undefined, vi.fn()))

    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('reconnects to the new tournament when tournamentId changes', () => {
    const { rerender } = renderHook(({ id }) => useTournamentLive(id, vi.fn()), {
      initialProps: { id: 'tournament-1' },
    })

    rerender({ id: 'tournament-2' })

    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[0].closed).toBe(true)
    expect(MockEventSource.instances[1].url).toContain('/tournaments/tournament-2/live')
  })
})
