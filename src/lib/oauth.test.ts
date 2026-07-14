import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, isBase64Url } from './oauth'

describe('buildAuthorizeUrl', () => {
  it('builds a Supabase authorize URL for google with pkce params', () => {
    const url = buildAuthorizeUrl({
      supabaseUrl: 'https://project-ref.supabase.co',
      anonKey: 'anon-key-123',
      provider: 'google',
      redirectTo: 'https://app.rallye.com/oauth/callback',
      codeChallenge: 'challenge-abc',
    })

    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'https://project-ref.supabase.co/auth/v1/authorize',
    )
    expect(parsed.searchParams.get('provider')).toBe('google')
    expect(parsed.searchParams.get('redirect_to')).toBe('https://app.rallye.com/oauth/callback')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('s256')
    expect(parsed.searchParams.get('apikey')).toBe('anon-key-123')
  })

  it('builds a Supabase authorize URL for apple', () => {
    const url = buildAuthorizeUrl({
      supabaseUrl: 'https://project-ref.supabase.co',
      anonKey: 'anon-key-123',
      provider: 'apple',
      redirectTo: 'https://app.rallye.com/oauth/callback',
      codeChallenge: 'challenge-abc',
    })

    expect(new URL(url).searchParams.get('provider')).toBe('apple')
  })
})

describe('isBase64Url', () => {
  it('accepts base64url-safe strings', () => {
    expect(isBase64Url('abcXYZ012_-')).toBe(true)
  })

  it('rejects strings with base64 padding or unsafe chars', () => {
    expect(isBase64Url('abc+/==')).toBe(false)
  })
})
