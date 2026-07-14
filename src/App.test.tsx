import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

function setPath(path: string) {
  window.history.pushState({}, '', path)
}

describe('App', () => {
  beforeEach(() => {
    setPath('/')
  })

  afterEach(() => {
    setPath('/')
  })

  it('renders the login page by default (A1)', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('renders the signup page at /signup (A2)', () => {
    setPath('/signup')
    render(<App />)
    expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('renders the oauth callback page at /oauth/callback', () => {
    setPath('/oauth/callback')
    render(<App />)
    expect(screen.getByLabelText(/concluindo login/i)).toBeInTheDocument()
  })
})
