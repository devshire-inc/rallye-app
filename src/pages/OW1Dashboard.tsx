import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell/AppShell'
import { StatCard } from '../components/ui/StatCard/StatCard'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { formatBRL } from '../lib/money'
import { getNetworkReport } from '../lib/api/reports'
import { getActiveTenantId } from '../lib/tenantContext'
import './DashboardPage.css'

/**
 * OW1 — Dashboard Tenant Owner (BEAC-2097, story BEAC-2051). 2 KPIs
 * agregados cross-unit via `GET /tenants/{id}/reports/{type}`
 * (`getNetworkReport`, já existente desde BEAC-1969 — decisão desta
 * implementação: nenhuma função nova foi necessária em `reports.ts`, o
 * gap "se não existir, adicionar uma" do texto da task não se aplica).
 * O backend já agrega todas as units ativas do tenant internamente
 * (`fetchActiveTenantUnitIDs`) — o componente só EXIBE o valor devolvido,
 * nunca itera units nem re-soma no frontend (AC). Nenhuma chamada de
 * listagem de units é introduzida (isso é escopo de OW2/UnitsPage, fora
 * desta story). `period` omitido — mesmo motivo de D3Dashboard: o backend
 * já assume o mês corrente quando ausente.
 */
export default function OW1Dashboard() {
  const { orgLabel, userLabel } = useShellIdentity()
  const tenantId = getActiveTenantId()
  const [revenue, setRevenue] = useState<number | null>(null)
  const [delinquency, setDelinquency] = useState<number | null>(null)

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false

    getNetworkReport(tenantId, 'fluxo-de-caixa').then((result) => {
      if (!cancelled && result.ok) setRevenue(result.report.cashFlow?.summary.receita ?? null)
    })
    getNetworkReport(tenantId, 'inadimplencia').then((result) => {
      if (!cancelled && result.ok) setDelinquency(result.report.delinquency?.summary.totalAmount ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [tenantId])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <main className="dashboard-page">
        <h1>Dashboard</h1>

        <div className="dash-body">
          <section data-testid="dashboard-kpis" className="stat4">
            <StatCard label="Receita do mês (rede)" value={revenue !== null ? formatBRL(revenue) : '—'} />
            <StatCard label="Inadimplência (rede)" value={delinquency !== null ? formatBRL(delinquency) : '—'} />
          </section>
        </div>
      </main>
    </AppShell>
  )
}
