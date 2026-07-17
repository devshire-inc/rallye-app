import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('marina', 300))

    expect(result.current).toBe('marina')
  })

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'ab' })
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(result.current).toBe('a')
  })

  it('updates to the latest value once the delay elapses (300ms default used by the members search bar)', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'ab' })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('ab')
  })

  it('resets the timer on rapid successive changes — only the final value after the delay is applied', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'm' },
    })

    rerender({ value: 'ma' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'mar' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'mari' })
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('m')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('mari')
  })
})
