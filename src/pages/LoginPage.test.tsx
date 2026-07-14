import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('renders the heading and the Google button', () => {
    render(<LoginPage searchParams={new URLSearchParams()} />)
    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.getByText(/continuar com google/i)).toBeInTheDocument()
  })

  it('shows the exact Google toast text when redirected back with oauth_error (backend-initiated failure)', () => {
    render(
      <LoginPage
        searchParams={new URLSearchParams('oauth_error=exchange_failed&provider=google')}
      />,
    )
    expect(
      screen.getByText('Não foi possível conectar com Google. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('defaults to the Google toast text when provider is absent from oauth_error redirect', () => {
    render(<LoginPage searchParams={new URLSearchParams('oauth_error=state_invalid')} />)
    expect(
      screen.getByText('Não foi possível conectar com Google. Tente novamente.'),
    ).toBeInTheDocument()
  })

  it('shows no toast when there is no oauth_error param', () => {
    render(<LoginPage searchParams={new URLSearchParams()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
