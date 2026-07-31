import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SocialAuthButton } from './SocialAuthButton'

describe('SocialAuthButton', () => {
  it('renders a native button with the label as its accessible name', () => {
    render(<SocialAuthButton label="Continuar com Google" />)
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument()
  })

  it('renders the neutral dashed placeholder when no logo is given', () => {
    const { container } = render(<SocialAuthButton />)
    expect(container.querySelector('.social-auth-button__logo-placeholder')).toBeInTheDocument()
  })

  it('renders the real BrandLogo SVG for a known logo name', () => {
    render(<SocialAuthButton logo="google" label="Continuar com Google" />)
    expect(document.querySelector('.brand-logo')).toBeInTheDocument()
    expect(document.querySelector('.social-auth-button__logo-placeholder')).not.toBeInTheDocument()
  })

  it('picks the white Apple mark on Dark style and the black mark otherwise', () => {
    const { rerender, container } = render(
      <SocialAuthButton logo="apple" style="dark" label="Continuar com Apple" />,
    )
    expect(container.querySelector('img[src*="apple-white"]')).toBeInTheDocument()

    rerender(<SocialAuthButton logo="apple" style="outline" label="Continuar com Apple" />)
    expect(container.querySelector('img[src*="apple-black"]')).toBeInTheDocument()
  })

  it('accepts a custom ReactNode logo', () => {
    render(<SocialAuthButton logo={<svg data-testid="custom-logo" />} />)
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument()
  })

  it.each(['outline', 'dark', 'light'] as const)('applies the style class for style=%s', (style) => {
    render(<SocialAuthButton style={style} />)
    expect(screen.getByRole('button')).toHaveClass(`social-auth-button--${style}`)
  })

  it('is disabled and does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<SocialAuthButton onClick={onClick} disabled />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<SocialAuthButton onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('CSS: full width, control-h-lg, radius/md, Light style uses fixed white/navy-900 tokens, no hex literals', () => {
    const css = readFileSync('src/components/ui/SocialAuthButton/SocialAuthButton.css', 'utf8')
    expect(css).toMatch(/width:\s*100%/)
    expect(css).toMatch(/height:\s*var\(--control-h-lg\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-md\)/)
    expect(css).toMatch(/\.social-auth-button--light\s*\{[^}]*background:\s*var\(--white\)/)
    expect(css).toMatch(/\.social-auth-button--light\s*\{[^}]*color:\s*var\(--navy-900\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--focus-ring\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
