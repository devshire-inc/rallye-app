import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonGroup } from './Skeleton'

describe('Skeleton', () => {
  it('type="text" renders 3 lines by default, all inside an aria-hidden container', () => {
    const { container } = render(<Skeleton type="text" />)
    const root = container.querySelector('.skeleton--text')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root!.querySelectorAll('.skeleton__line')).toHaveLength(3)
  })

  it('type="text" honors a custom `lines` count', () => {
    const { container } = render(<Skeleton type="text" lines={5} />)
    expect(container.querySelectorAll('.skeleton__line')).toHaveLength(5)
  })

  it('type="avatar" renders a single circular shape, aria-hidden', () => {
    const { container } = render(<Skeleton type="avatar" />)
    const el = container.querySelector('.skeleton--avatar')
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).toHaveClass('skeleton__shape')
  })

  it('type="card" renders one image block and 2 caption lines, aria-hidden', () => {
    const { container } = render(<Skeleton type="card" />)
    const root = container.querySelector('.skeleton--card')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root!.querySelectorAll('.skeleton__image')).toHaveLength(1)
    expect(root!.querySelectorAll('.skeleton__line')).toHaveLength(2)
  })

  it('type="tableRow" renders an avatar and 3 text blocks, aria-hidden', () => {
    const { container } = render(<Skeleton type="tableRow" />)
    const root = container.querySelector('.skeleton--tableRow')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root!.querySelectorAll('.skeleton__avatar')).toHaveLength(1)
    expect(root!.querySelectorAll('.skeleton__line')).toHaveLength(3)
  })

  it('every shape carries skeleton__shape (base + shimmer overlay class)', () => {
    const { container } = render(<Skeleton type="card" />)
    const shapes = container.querySelectorAll('.skeleton__shape')
    expect(shapes.length).toBeGreaterThan(0)
    shapes.forEach((shape) => expect(shape).toHaveClass('skeleton__shape'))
  })

  it('accepts an extra className on the root', () => {
    const { container } = render(<Skeleton type="avatar" className="custom" />)
    expect(container.querySelector('.skeleton--avatar')).toHaveClass('custom')
  })

  it('CSS: type dimensions and radii match the Figma spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Skeleton/Skeleton.css', 'utf8')
    // Type=Text (node 201:2)
    expect(css).toMatch(/\.skeleton--text\s*{[^}]*width:\s*220px/)
    expect(css).toMatch(/\.skeleton--text \.skeleton__line\s*{[^}]*height:\s*12px/)
    // Type=Avatar (node 201:12)
    expect(css).toMatch(/\.skeleton--avatar\s*{[^}]*width:\s*48px/)
    expect(css).toMatch(/\.skeleton--avatar\s*{[^}]*height:\s*48px/)
    expect(css).toMatch(/\.skeleton--avatar\s*{[^}]*border-radius:\s*var\(--radius-pill\)/)
    // Type=Card (node 201:16)
    expect(css).toMatch(/\.skeleton--card \.skeleton__image\s*{[^}]*width:\s*240px/)
    expect(css).toMatch(/\.skeleton--card \.skeleton__image\s*{[^}]*height:\s*120px/)
    expect(css).toMatch(/\.skeleton--card \.skeleton__image\s*{[^}]*border-radius:\s*var\(--radius-lg\)/)
    // Type=TableRow (node 201:26) — same height as the real Table Row (56px)
    expect(css).toMatch(/\.skeleton--tableRow\s*{[^}]*height:\s*56px/)
    expect(css).toMatch(/\.skeleton--tableRow \.skeleton__avatar\s*{[^}]*width:\s*32px/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: base shape uses surface/sunken, the shimmer gradient is a documented literal exception', () => {
    const css = readFileSync('src/components/ui/Skeleton/Skeleton.css', 'utf8')
    expect(css).toMatch(/\.skeleton__shape\s*{[^}]*background:\s*var\(--surface-sunken\)/)
    expect(css).toMatch(
      /background:\s*linear-gradient\(90deg,\s*transparent,\s*rgba\(255,\s*255,\s*255,\s*\.55\),\s*transparent\)/,
    )
    // documented as an exception right next to the literal, so it doesn't get "fixed" into a token
    expect(css).toMatch(/Exceção documentada/)
  })

  it('CSS: shimmer animates via a literal 1.5s duration not present in the effects token scale', () => {
    const css = readFileSync('src/components/ui/Skeleton/Skeleton.css', 'utf8')
    expect(css).toMatch(/animation:\s*skeleton-shimmer\s*1\.5s\s*linear\s*infinite/)
    expect(css).not.toMatch(/animation:\s*skeleton-shimmer\s*var\(--dur-/)
  })

  it('CSS: prefers-reduced-motion freezes the shimmer (no animation, static surface/sunken block)', () => {
    const css = readFileSync('src/components/ui/Skeleton/Skeleton.css', 'utf8')
    const reducedMotionBlock = css.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*{([^}]*{[^}]*})*[^}]*}/)
    expect(reducedMotionBlock).not.toBeNull()
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)\s*{\s*\.skeleton__shape::after\s*{\s*animation:\s*none/)
  })
})

describe('SkeletonGroup', () => {
  it('renders the label once in a single aria-live region, regardless of how many skeletons it wraps', () => {
    render(
      <SkeletonGroup label="Carregando reservas">
        <Skeleton type="tableRow" />
        <Skeleton type="tableRow" />
        <Skeleton type="tableRow" />
      </SkeletonGroup>,
    )
    const liveRegions = screen.getAllByRole('status')
    expect(liveRegions).toHaveLength(1)
    expect(liveRegions[0]).toHaveTextContent('Carregando reservas')
    expect(liveRegions[0]).toHaveAttribute('aria-live', 'polite')
  })

  it('renders all wrapped skeleton children', () => {
    const { container } = render(
      <SkeletonGroup label="Carregando reservas">
        <Skeleton type="card" />
        <Skeleton type="card" />
      </SkeletonGroup>,
    )
    expect(container.querySelectorAll('.skeleton--card')).toHaveLength(2)
  })

  it('CSS: the announcement text is visually hidden, not just aria-live', () => {
    const css = readFileSync('src/components/ui/Skeleton/Skeleton.css', 'utf8')
    expect(css).toMatch(/\.skeleton-group__announcement\s*{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/)
  })
})
