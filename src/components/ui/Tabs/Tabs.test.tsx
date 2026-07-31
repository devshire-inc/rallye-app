import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'

const TAB_NAMES = ['Visão geral', 'Financeiro', 'Configurações']

function ControlledTabs() {
  const [value, setValue] = useState('Visão geral')
  return <Tabs tabs={TAB_NAMES} value={value} onChange={setValue} />
}

describe('Tabs', () => {
  it('renders role="tablist" with the default ariaLabel', () => {
    render(<Tabs tabs={TAB_NAMES} value="Visão geral" />)
    expect(screen.getByRole('tablist', { name: 'Abas de navegação' })).toBeInTheDocument()
  })

  it('accepts a custom ariaLabel', () => {
    render(<Tabs tabs={TAB_NAMES} value="Visão geral" ariaLabel="Seções do painel" />)
    expect(screen.getByRole('tablist', { name: 'Seções do painel' })).toBeInTheDocument()
  })

  it('renders role="tab" with aria-selected, only the selected tab has tabIndex=0', () => {
    render(<Tabs tabs={TAB_NAMES} value="Financeiro" />)
    const overview = screen.getByRole('tab', { name: 'Visão geral' })
    const financial = screen.getByRole('tab', { name: 'Financeiro' })
    const settings = screen.getByRole('tab', { name: 'Configurações' })

    expect(overview).toHaveAttribute('aria-selected', 'false')
    expect(financial).toHaveAttribute('aria-selected', 'true')
    expect(settings).toHaveAttribute('aria-selected', 'false')

    expect(overview).toHaveAttribute('tabIndex', '-1')
    expect(financial).toHaveAttribute('tabIndex', '0')
    expect(settings).toHaveAttribute('tabIndex', '-1')
  })

  it('calls onChange when a tab is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Tabs tabs={TAB_NAMES} value="Visão geral" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(onChange).toHaveBeenCalledWith('Financeiro')
  })

  it('ArrowRight moves selection forward with wraparound at the end', async () => {
    const user = userEvent.setup()
    render(<ControlledTabs />)
    screen.getByRole('tab', { name: 'Visão geral' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Financeiro' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Configurações' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('ArrowLeft moves selection backward with wraparound at the start', async () => {
    const user = userEvent.setup()
    render(<ControlledTabs />)
    screen.getByRole('tab', { name: 'Visão geral' }).focus()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Configurações' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('Home selects the first tab, End selects the last', async () => {
    const user = userEvent.setup()
    render(<ControlledTabs />)
    screen.getByRole('tab', { name: 'Visão geral' }).focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Configurações' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('moves DOM focus to the newly selected tab (roving tabindex) on arrow navigation', async () => {
    const user = userEvent.setup()
    render(<ControlledTabs />)
    screen.getByRole('tab', { name: 'Visão geral' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Financeiro' })).toHaveFocus()
  })

  it('renders a single sliding indicator under the active tab, positioned via CSS custom properties', () => {
    const { container } = render(<Tabs tabs={TAB_NAMES} value="Financeiro" />)
    const indicators = container.querySelectorAll('.tabs__indicator')
    expect(indicators).toHaveLength(1)
    const indicator = indicators[0] as HTMLElement
    expect(indicator).toHaveAttribute('aria-hidden', 'true')
    expect(indicator.style.getPropertyValue('--tabs-indicator-x')).toMatch(/^-?\d+(\.\d+)?px$/)
    expect(indicator.style.getPropertyValue('--tabs-indicator-width')).toMatch(/^\d+(\.\d+)?px$/)
  })

  it('renders no indicator when the current value matches no tab', () => {
    const { container } = render(<Tabs tabs={TAB_NAMES} value="Inexistente" />)
    expect(container.querySelectorAll('.tabs__indicator')).toHaveLength(0)
  })

  it('CSS: container, tab, and indicator dimensions/tokens per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Tabs/Tabs.css', 'utf8')
    expect(css).toMatch(/gap:\s*var\(--space-6\)/)
    expect(css).toMatch(/font:\s*var\(--type-label\)/)
    expect(css).toMatch(/color:\s*var\(--text-heading\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
    expect(css).toMatch(/min-height:\s*var\(--control-h-sm\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--focus-ring\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: the shared indicator owns the underline and slides via transform/width transitions', () => {
    const css = readFileSync('src/components/ui/Tabs/Tabs.css', 'utf8')
    expect(css).toMatch(/\.tabs__indicator\s*\{[^}]*background:\s*var\(--interactive-primary\)/s)
    expect(css).toMatch(
      /\.tabs__indicator\s*\{[^}]*transform:\s*translateX\(var\(--tabs-indicator-x, 0\)\)/s,
    )
    expect(css).toMatch(/\.tabs__indicator\s*\{[^}]*width:\s*var\(--tabs-indicator-width, 0\)/s)
    expect(css).toMatch(
      /transition:\s*\n\s*transform var\(--dur-base\) var\(--ease-standard\),\s*\n\s*width var\(--dur-base\) var\(--ease-standard\)/,
    )
    expect(css).not.toMatch(/\.tabs__tab--active\s*\{[^}]*box-shadow:/s)
  })
})
