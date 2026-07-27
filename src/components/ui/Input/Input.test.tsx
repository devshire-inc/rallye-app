import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('is locatable via getByLabelText when label is given, and htmlFor/id match', () => {
    render(<Input label="E-mail" />)
    const input = screen.getByLabelText('E-mail')
    const label = screen.getByText('E-mail')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', input.id)
  })

  it('is locatable via getByLabelText when only ariaLabel is given (no visible label)', () => {
    render(<Input ariaLabel="Buscar quadra" />)
    const input = screen.getByLabelText('Buscar quadra')
    expect(screen.queryByRole('label')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-label', 'Buscar quadra')
  })

  it('honors an explicit id instead of generating one', () => {
    render(<Input label="Nome" id="custom-id" />)
    expect(screen.getByLabelText('Nome')).toHaveAttribute('id', 'custom-id')
  })

  it('renders helper text and error text when given', () => {
    render(<Input label="Senha" helper="Mínimo 8 caracteres" error="Senha inválida" />)
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Senha inválida')).toBeInTheDocument()
  })

  it('renders a prefix when given', () => {
    render(<Input label="Preço" prefix="R$" />)
    expect(screen.getByText('R$')).toBeInTheDocument()
  })

  it('forwards native input attributes and disabled without breaking id/htmlFor', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input label="Apelido" placeholder="ex: Bruno" maxLength={5} onChange={onChange} />)
    const input = screen.getByLabelText('Apelido')
    expect(input).toHaveAttribute('placeholder', 'ex: Bruno')
    expect(input).toHaveAttribute('maxlength', '5')
    await user.type(input, 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards disabled', () => {
    render(<Input label="Campo" disabled />)
    expect(screen.getByLabelText('Campo')).toBeDisabled()
  })

  it('CSS: height, radius, border, font per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Input/Input.css', 'utf8')
    expect(css).toMatch(/height:\s*var\(--control-h-md\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-md\)/)
    expect(css).toMatch(/border:\s*1px solid var\(--border-default\)/)
    expect(css).toMatch(/font:\s*var\(--type-body\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
