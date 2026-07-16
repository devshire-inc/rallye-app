import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

function Pressable({ onLongPress }: { onLongPress: () => void }) {
  const handlers = useLongPress(onLongPress, 600)
  return (
    <button type="button" {...handlers}>
      rallye.
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLongPress', () => {
  it('fires onLongPress after holding past the delay', () => {
    const onLongPress = vi.fn()
    render(<Pressable onLongPress={onLongPress} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(600)

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('does not fire when released before the delay (a short tap)', () => {
    const onLongPress = vi.fn()
    render(<Pressable onLongPress={onLongPress} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(300)
    fireEvent.pointerUp(screen.getByRole('button'))
    vi.advanceTimersByTime(600)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('cancels the pending press on pointerLeave (finger/cursor drags off)', () => {
    const onLongPress = vi.fn()
    render(<Pressable onLongPress={onLongPress} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(300)
    fireEvent.pointerLeave(screen.getByRole('button'))
    vi.advanceTimersByTime(600)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('cancels the pending press on pointerCancel', () => {
    const onLongPress = vi.fn()
    render(<Pressable onLongPress={onLongPress} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(300)
    fireEvent.pointerCancel(screen.getByRole('button'))
    vi.advanceTimersByTime(600)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('supports a second press after the first completes', () => {
    const onLongPress = vi.fn()
    render(<Pressable onLongPress={onLongPress} />)

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(600)
    fireEvent.pointerUp(screen.getByRole('button'))

    fireEvent.pointerDown(screen.getByRole('button'))
    vi.advanceTimersByTime(600)

    expect(onLongPress).toHaveBeenCalledTimes(2)
  })
})
