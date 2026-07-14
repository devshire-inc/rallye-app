import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthCallback } from './OAuthCallback'

describe('OAuthCallback', () => {
  beforeEach(() => {
    sessionStorage.setItem('rallye.oauth.code_verifier', 'verifier-123')
    sessionStorage.setItem('rallye.oauth.provider', 'google')
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
  })

  it('navigates straight to the dashboard on success (never to A4)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'active' }),
    })
    const navigate = vi.fn()

    render(
      <OAuthCallback
        code="valid-code"
        fetchImpl={fetchImpl as unknown as typeof fetch}
        navigate={navigate}
      />,
    )

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows the exact toast text and does not navigate on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    const navigate = vi.fn()

    render(
      <OAuthCallback
        code="bad-code"
        fetchImpl={fetchImpl as unknown as typeof fetch}
        navigate={navigate}
      />,
    )

    await screen.findByText('Não foi possível conectar com Google. Tente novamente.')
    expect(navigate).not.toHaveBeenCalled()
  })
})
