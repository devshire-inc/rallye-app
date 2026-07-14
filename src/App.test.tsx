import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects the root route to the email verification screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /verificação de e-mail/i })).toBeInTheDocument()
  })
})
