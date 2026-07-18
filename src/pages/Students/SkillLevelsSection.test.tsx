import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as skillLevelsApi from '../../lib/api/skillLevels'
import * as usePermissionModule from '../../hooks/usePermission'
import { SkillLevelsSection } from './SkillLevelsSection'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermission(allowed: boolean) {
  vi.spyOn(usePermissionModule, 'usePermission').mockReturnValue(allowed)
}

describe('SkillLevelsSection — loading and error', () => {
  it('shows a loading status while skill levels are being fetched', () => {
    mockPermission(true)
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockReturnValue(new Promise(() => {}))

    render(<SkillLevelsSection studentId="student-1" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermission(true)
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    render(<SkillLevelsSection studentId="student-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar os níveis/i,
    )
  })

  it('shows an empty state when the student has no sport practiced yet', async () => {
    mockPermission(true)
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockResolvedValue({ ok: true, skillLevels: [] })

    render(<SkillLevelsSection studentId="student-1" />)

    expect(await screen.findByText(/nenhum esporte com nível registrado/i)).toBeInTheDocument()
  })
})

describe('SkillLevelsSection — one chiprow per practiced sport, editable', () => {
  function mockTwoSports() {
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockResolvedValue({
      ok: true,
      skillLevels: [
        {
          sport: 'beach_tennis',
          tier: 'b',
          updatedBy: 'user-1',
          updatedAt: '2026-07-01T00:00:00Z',
        },
        { sport: 'padel', tier: 'pe_na_areia', updatedBy: null, updatedAt: '2026-07-02T00:00:00Z' },
      ],
    })
  }

  it('renders a chiprow per practiced sport using the real API sport slug as data-tier-group, 6 tiers, single aria-pressed', async () => {
    mockPermission(true)
    mockTwoSports()

    const { container } = render(<SkillLevelsSection studentId="student-1" />)

    await screen.findByText('Beach tennis')
    expect(screen.getByText('Padel')).toBeInTheDocument()

    const btRow = container.querySelector('[data-tier-group="beach_tennis"]')
    const padelRow = container.querySelector('[data-tier-group="padel"]')
    expect(btRow).not.toBeNull()
    expect(padelRow).not.toBeNull()

    const btChips = btRow!.querySelectorAll('button.chip')
    expect(btChips).toHaveLength(6)
    expect(
      Array.from(btChips).map((chip) => [chip.textContent, chip.getAttribute('aria-pressed')]),
    ).toEqual([
      ['Pé na Areia', 'false'],
      ['D', 'false'],
      ['C', 'false'],
      ['B', 'true'],
      ['A', 'false'],
      ['Pro/Open', 'false'],
    ])

    const padelChips = padelRow!.querySelectorAll('button.chip')
    expect(
      Array.from(padelChips).map((chip) => [chip.textContent, chip.getAttribute('aria-pressed')]),
    ).toEqual([
      ['Pé na Areia', 'true'],
      ['D', 'false'],
      ['C', 'false'],
      ['B', 'false'],
      ['A', 'false'],
      ['Pro/Open', 'false'],
    ])
  })

  it('shows the exact hint copy from the prototype', async () => {
    mockPermission(true)
    mockTwoSports()

    render(<SkillLevelsSection studentId="student-1" />)

    await screen.findByText('Beach tennis')
    expect(
      screen.getByText(
        'Editável por Admin e Professor. Um valor por esporte praticado — não é um campo único "nível do aluno".',
      ),
    ).toBeInTheDocument()
  })

  it('reflects a tier change immediately (optimistic) and calls PATCH with the real sport slug', async () => {
    mockPermission(true)
    mockTwoSports()
    const patchSpy = vi.spyOn(skillLevelsApi, 'patchSkillLevel').mockResolvedValue({
      ok: true,
      skillLevel: {
        sport: 'beach_tennis',
        tier: 'a',
        updatedBy: 'user-1',
        updatedAt: '2026-07-18T00:00:00Z',
      },
    })

    const { container } = render(<SkillLevelsSection studentId="student-1" />)
    await screen.findByText('Beach tennis')

    const btRow = container.querySelector('[data-tier-group="beach_tennis"]')!
    const chipA = Array.from(btRow.querySelectorAll('button.chip')).find(
      (c) => c.textContent === 'A',
    )!
    await userEvent.click(chipA)

    // Reflete imediatamente, antes mesmo do PATCH resolver.
    expect(chipA.getAttribute('aria-pressed')).toBe('true')
    expect(patchSpy).toHaveBeenCalledWith('student-1', 'beach_tennis', 'a')

    await waitFor(() => expect(chipA.getAttribute('aria-pressed')).toBe('true'))
    const chipB = Array.from(btRow.querySelectorAll('button.chip')).find(
      (c) => c.textContent === 'B',
    )!
    expect(chipB.getAttribute('aria-pressed')).toBe('false')
  })

  it('rolls back the optimistic change and shows an inline error when the PATCH fails', async () => {
    mockPermission(true)
    mockTwoSports()
    vi.spyOn(skillLevelsApi, 'patchSkillLevel').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'patch_skill_level_failed',
    })

    const { container } = render(<SkillLevelsSection studentId="student-1" />)
    await screen.findByText('Beach tennis')

    const btRow = container.querySelector('[data-tier-group="beach_tennis"]')!
    const chipA = Array.from(btRow.querySelectorAll('button.chip')).find(
      (c) => c.textContent === 'A',
    )!
    await userEvent.click(chipA)

    await waitFor(() => expect(chipA.getAttribute('aria-pressed')).toBe('false'))
    const chipB = Array.from(btRow.querySelectorAll('button.chip')).find(
      (c) => c.textContent === 'B',
    )!
    expect(chipB.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível salvar/i)
  })
})

describe('SkillLevelsSection — read-only without alunos:write (hide always, never disable)', () => {
  it('renders the tiers as non-interactive spans, never a disabled button', async () => {
    mockPermission(false)
    vi.spyOn(skillLevelsApi, 'listSkillLevels').mockResolvedValue({
      ok: true,
      skillLevels: [
        {
          sport: 'beach_tennis',
          tier: 'b',
          updatedBy: 'user-1',
          updatedAt: '2026-07-01T00:00:00Z',
        },
      ],
    })

    const { container } = render(<SkillLevelsSection studentId="student-1" />)
    await screen.findByText('Beach tennis')

    expect(
      screen.queryAllByRole('button', { name: /pé na areia|^d$|^c$|^b$|^a$|pro\/open/i }),
    ).toHaveLength(0)
    const btRow = container.querySelector('[data-tier-group="beach_tennis"]')!
    const chips = btRow.querySelectorAll('span.chip')
    expect(chips).toHaveLength(6)
    const selected = btRow.querySelector('span.chip.chip--selected')
    expect(selected).not.toBeNull()
    expect(selected!.textContent).toBe('B')
  })
})
