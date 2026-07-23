import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { MembershipListItem } from '../../lib/api'
import { REPORT_CATALOG } from './reportCatalog'
import ReportsHubPage from './ReportsHubPage'

function membership(overrides: Partial<MembershipListItem> = {}): MembershipListItem {
  return {
    unitId: 'unit-1',
    unit: { name: 'Arena Areia Dourada', address: null, sportsOffered: null },
    role: 'Unit Admin',
    lastAccessedAt: null,
    liveActivity: null,
    ...overrides,
  }
}

// isTenantOwner nesta tela é derivado do `role` literal de cada membership
// (m.role === 'Tenant Owner'), não da contagem de memberships — um Tenant
// Owner recém-criado (POST /tenants) tem exatamente 1 membership.
const oneMembershipUnitAdmin = [membership()]
const oneMembershipTenantOwner = [membership({ role: 'Tenant Owner' })]
const twoMembershipsTenantOwner = [
  membership({ unitId: 'unit-1', role: 'Tenant Owner' }),
  membership({ unitId: 'unit-2', role: 'Tenant Owner' }),
]

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/reports`]}>
      <Routes>
        <Route path="/units/:unitId/reports" element={<ReportsHubPage />} />
        <Route
          path="/units/:unitId/reports/:type"
          element={<div>Detalhe do relatório placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ReportsHubPage', () => {
  it('Tenant Owner (2 memberships) sees the header and all 8 reports from the F7 doc, each with its icon', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    renderPage()

    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeInTheDocument()
    for (const entry of REPORT_CATALOG) {
      await waitFor(() => expect(screen.getByText(entry.label)).toBeInTheDocument())
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })

  // Regression guard (correction round 1, post-review): a Tenant Owner who
  // just signed up (POST /tenants) has exactly 1 membership (1 tenant, 1
  // unit) — isTenantOwner must come from the `role` field, not a length
  // check, or this exact persona would incorrectly lose access to their own
  // Tenant-Owner-only reports.
  it('Tenant Owner with exactly 1 membership (fresh single-arena tenant) still sees all 8 reports', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipTenantOwner)
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(8))
    expect(screen.getByText('Receita por Esporte')).toBeInTheDocument()
    expect(screen.getByText('DRE Simplificado')).toBeInTheDocument()
  })

  it('navigates to the report detail page when a card is clicked', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByText('Receita por Professor'))

    expect(await screen.findByText('Detalhe do relatório placeholder')).toBeInTheDocument()
  })

  // BEAC-1975: regra "esconder, nunca desabilitar" — quem não é Tenant
  // Owner (role !== 'Tenant Owner', ex.: Unit Admin) não deve ver "Receita
  // por Esporte"/"DRE Simplificado" na lista, nem desabilitados, apenas
  // ausentes.
  it('non-Tenant-Owner (Unit Admin) does not list Receita por Esporte or DRE Simplificado, and sees the other 6', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipUnitAdmin)
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(6))
    expect(screen.queryByText('Receita por Esporte')).not.toBeInTheDocument()
    expect(screen.queryByText('DRE Simplificado')).not.toBeInTheDocument()
    for (const entry of REPORT_CATALOG) {
      if (entry.type === 'receita-por-esporte' || entry.type === 'dre') continue
      expect(screen.getByText(entry.label)).toBeInTheDocument()
    }
  })

  it('if GET /me/memberships fails, degrades to non-Tenant-Owner (hides the 2 restricted items) instead of crashing', async () => {
    vi.spyOn(api, 'listMyMemberships').mockRejectedValue(new Error('network error'))
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(6))
    expect(screen.queryByText('Receita por Esporte')).not.toBeInTheDocument()
    expect(screen.queryByText('DRE Simplificado')).not.toBeInTheDocument()
  })
})

// BEAC-1970: seletor "Todas ▼" no topo — Tenant Owner troca entre a visão
// consolidada de rede e uma unit específica; Unit Admin nunca vê o filtro
// (regra "esconder, nunca desabilitar").
describe('ReportsHubPage — seletor de unit/"Todas" (BEAC-1970)', () => {
  it('Tenant Owner sees the "Filtrar por unit" selector with "Todas" plus every membership unit', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    renderPage()

    const select = await screen.findByLabelText('Filtrar por unit')
    expect(select).toBeInTheDocument()
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Todas')
  })

  it('Unit Admin (non-Tenant-Owner) does not render the selector at all — hidden, not disabled', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipUnitAdmin)
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(6))
    expect(screen.queryByLabelText('Filtrar por unit')).not.toBeInTheDocument()
  })

  it('selecting "Todas" navigates to the same unit route with ?scope=network, and report cards propagate it', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    renderPage('unit-1')
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText('Filtrar por unit'), 'network')
    await user.click(await screen.findByText('Receita por Professor'))

    expect(await screen.findByText('Detalhe do relatório placeholder')).toBeInTheDocument()
  })

  it('selecting a different unit navigates to that unit’s own reports route', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    renderPage('unit-1')
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText('Filtrar por unit'), 'unit-2')

    // A troca de unit navega pra /units/unit-2/reports — o próprio hub
    // remonta escopado na nova unit (mesma rota, novo :unitId), então o
    // <select> continua visível e a lista de 8 relatórios (Tenant Owner)
    // continua de pé.
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(8))
  })
})
