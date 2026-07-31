import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('announces "Página N de M" exactly, per the a11y doc', () => {
    render(<Pagination page={3} totalPages={9} onPageChange={() => {}} />)
    expect(screen.getByText('Página 3 de 9')).toBeInTheDocument()
  })

  it('marks the count text as a live region so page changes are announced', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByText('Página 1 de 5')).toHaveAttribute('aria-live', 'polite')
  })

  it('marks the active page with aria-current="page"', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />)
    const active = screen.getByRole('button', { name: 'Página 2' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active.className).toContain('pagination__page--active')
  })

  it('disables "Página anterior" on the first page and "Próxima página" on the last page', () => {
    const { rerender } = render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima página' })).not.toBeDisabled()

    rerender(<Pagination page={5} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })

  it('calls onPageChange with the clicked page number', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Página 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with page - 1 / page + 1 for the prev/next controls', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('all controls are real <button> elements, reachable by Tab', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    }
  })

  it('expands the page window with siblingCount', () => {
    render(<Pagination page={5} totalPages={10} onPageChange={() => {}} siblingCount={2} />)
    for (const p of [3, 4, 5, 6, 7]) {
      expect(screen.getByRole('button', { name: `Página ${p}` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Página 2' })).not.toBeInTheDocument()
  })

  it('CSS: active page uses interactive/primary bg + text/on-brand, no hex literals', () => {
    const css = readFileSync('src/components/ui/Pagination/Pagination.css', 'utf8')
    expect(css).toMatch(/\.pagination__page--active\s*{[^}]*background:\s*var\(--interactive-primary\);/)
    expect(css).toMatch(/\.pagination__page--active\s*{[^}]*color:\s*var\(--text-on-brand\);/)
    expect(css).toMatch(/font:\s*var\(--type-small\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
