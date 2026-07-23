import { describe, expect, it } from 'vitest'
import { isNetworkScope, networkScopeQuery } from './reportScope'

describe('isNetworkScope', () => {
  it('is true when the URL carries ?scope=network', () => {
    expect(isNetworkScope(new URLSearchParams('scope=network'))).toBe(true)
  })

  it('is false when there is no scope query param', () => {
    expect(isNetworkScope(new URLSearchParams())).toBe(false)
  })

  it('is false for any other scope value (e.g. a stray unit id)', () => {
    expect(isNetworkScope(new URLSearchParams('scope=unit-1'))).toBe(false)
  })
})

describe('networkScopeQuery', () => {
  it('returns the literal "?scope=network" query string', () => {
    expect(networkScopeQuery()).toBe('?scope=network')
  })
})
