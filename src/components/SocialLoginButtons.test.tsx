import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialLoginButtons } from './SocialLoginButtons'

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
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

  it('navigates (full-page) to the backend authorize endpoint when Google is clicked', () => {
    const navigate = vi.fn()
    render(<SocialLoginButtons onError={vi.fn()} navigate={navigate} />)

    fireEvent.click(screen.getByText(/continuar com google/i))

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(
      'http://localhost:8080/auth/oauth/authorize?provider=google',
    )
  })

  it('shows the exact toast text when the API base URL is not configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const onError = vi.fn()
    render(<SocialLoginButtons onError={onError} />)

    fireEvent.click(screen.getByText(/continuar com google/i))

    expect(onError).toHaveBeenCalledWith('Não foi possível conectar com Google. Tente novamente.')
  })
})
