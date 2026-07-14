import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialLoginButtons } from './SocialLoginButtons'

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project-ref.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    sessionStorage.clear()
  })

  it('renders the Google button', () => {
    render(<SocialLoginButtons onError={vi.fn()} />)
    expect(screen.getByText(/continuar com google/i)).toBeInTheDocument()
  })

  it('hides the Apple button while BEAC-1814 (Apple) is blocked (appleEnabled=false)', () => {
    render(<SocialLoginButtons onError={vi.fn()} appleEnabled={false} />)
    expect(screen.queryByText(/continuar com apple/i)).not.toBeInTheDocument()
  })

  it('shows the Apple button once appleEnabled=true', () => {
    render(<SocialLoginButtons onError={vi.fn()} appleEnabled={true} />)
    expect(screen.getByText(/continuar com apple/i)).toBeInTheDocument()
  })

  it('starts the OAuth flow (redirects) when Google is clicked with env configured', async () => {
    const navigate = vi.fn()
    render(<SocialLoginButtons onError={vi.fn()} navigate={navigate} />)

    fireEvent.click(screen.getByText(/continuar com google/i))

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1)
    })
    expect(navigate.mock.calls[0][0]).toContain('https://project-ref.supabase.co/auth/v1/authorize')
  })

  it('shows the exact toast text on failure (missing Supabase config)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const onError = vi.fn()
    render(<SocialLoginButtons onError={onError} />)

    fireEvent.click(screen.getByText(/continuar com google/i))

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Não foi possível conectar com Google. Tente novamente.')
    })
  })
})
