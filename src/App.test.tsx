import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the login stub (A1) at the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('renders the forgot-password page at /esqueci-senha', () => {
    render(
      <MemoryRouter initialEntries={['/esqueci-senha']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /esqueci minha senha/i })).toBeInTheDocument()
  })

  it('renders the reset-password page at /redefinir-senha', () => {
    render(
      <MemoryRouter initialEntries={['/redefinir-senha']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /redefinir senha/i })).toBeInTheDocument()
  })
})
