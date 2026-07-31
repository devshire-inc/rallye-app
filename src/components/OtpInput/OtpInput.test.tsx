import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput'

function boxes() {
  return screen.getAllByRole('textbox')
}

describe('OtpInput', () => {
  it('renders 6 boxes by default', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    expect(boxes()).toHaveLength(6)
  })

  it('auto-advances focus to the next box on digit entry', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    const inputs = boxes()
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(inputs[1]).toHaveFocus()
  })

  it('calls onChange with the accumulated digit string', () => {
    const onChange = vi.fn()
    const { rerender } = render(<OtpInput value="" onChange={onChange} />)
    fireEvent.change(boxes()[0], { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith('1')

    rerender(<OtpInput value="1" onChange={onChange} />)
    fireEvent.change(boxes()[1], { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith('12')
  })

  it('calls onComplete once all boxes are filled', () => {
    const onComplete = vi.fn()
    const onChange = vi.fn()
    render(<OtpInput value="12345" onChange={onChange} onComplete={onComplete} />)
    fireEvent.change(boxes()[5], { target: { value: '6' } })
    expect(onChange).toHaveBeenLastCalledWith('123456')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('moves focus back to the previous box on backspace from an empty box', () => {
    render(<OtpInput value="1" onChange={() => {}} />)
    const inputs = boxes()
    inputs[1].focus()
    fireEvent.keyDown(inputs[1], { key: 'Backspace' })
    expect(inputs[0]).toHaveFocus()
  })

  it('applies the error class (shake) when error is true', () => {
    render(<OtpInput value="" onChange={() => {}} error />)
    expect(screen.getByRole('group')).toHaveClass('otp-input--error')
  })

  it('distributes a pasted 6-digit code across all boxes', () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)
    const inputs = boxes()
    const clipboardData = { getData: () => '123456' }
    fireEvent.paste(inputs[0], { clipboardData })
    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('uses a numeric input mode for a numeric keyboard on mobile', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    for (const input of boxes()) {
      expect(input).toHaveAttribute('inputMode', 'numeric')
    }
  })

  describe('live region (BEAC-2082)', () => {
    it('announces progress as digits are filled', () => {
      const onChange = vi.fn()
      const { rerender } = render(<OtpInput value="" onChange={onChange} />)
      expect(screen.getByRole('status')).toHaveTextContent('0 de 6')

      fireEvent.change(boxes()[0], { target: { value: '1' } })
      rerender(<OtpInput value={onChange.mock.calls[0][0]} onChange={onChange} />)
      expect(screen.getByRole('status')).toHaveTextContent('1 de 6')
    })

    it('announces progress going back down when a digit is removed', () => {
      const onChange = vi.fn()
      const { rerender } = render(<OtpInput value="12" onChange={onChange} />)
      expect(screen.getByRole('status')).toHaveTextContent('2 de 6')

      rerender(<OtpInput value="1" onChange={onChange} />)
      expect(screen.getByRole('status')).toHaveTextContent('1 de 6')
    })

    it('announces a distinct completion message once all digits are filled', () => {
      const onChange = vi.fn()
      const { rerender } = render(<OtpInput value="12345" onChange={onChange} />)
      fireEvent.change(boxes()[5], { target: { value: '6' } })
      rerender(<OtpInput value={onChange.mock.calls[0][0]} onChange={onChange} />)
      expect(screen.getByRole('status')).toHaveTextContent('Código completo')
    })

    it('has no accessibility violations', async () => {
      const { container } = render(<OtpInput value="123" onChange={() => {}} />)
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('visual spec (Figma node 277:1574)', () => {
    it('marks a box as filled once it holds a digit', () => {
      render(<OtpInput value="1" onChange={() => {}} />)
      const inputs = boxes()
      expect(inputs[0]).toHaveClass('otp-input__box--filled')
      expect(inputs[1]).not.toHaveClass('otp-input__box--filled')
    })

    it('CSS: 48x56 boxes, radius/md, border/default vs border/strong, focus ring on the control', () => {
      const css = readFileSync('src/components/OtpInput/OtpInput.css', 'utf8')
      expect(css).toMatch(/width:\s*48px/)
      expect(css).toMatch(/height:\s*56px/)
      expect(css).toMatch(/border-radius:\s*var\(--radius-md\)/)
      expect(css).toMatch(/border:\s*1\.5px solid var\(--border-default\)/)
      expect(css).toMatch(/--border-strong\)/)
      expect(css).toMatch(/box-shadow:\s*var\(--focus-ring\)/)
      expect(css).toMatch(/--state-danger\)/)
      expect(css).toMatch(/--state-danger-text\)/)
    })
  })
})
