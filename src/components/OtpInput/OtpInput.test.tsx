import { fireEvent, render, screen } from '@testing-library/react'
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
})
