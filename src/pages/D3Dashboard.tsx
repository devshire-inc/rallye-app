import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell/AppShell'
import { Card } from '../components/ui/Card/Card'
import { StatCard } from '../components/ui/StatCard/StatCard'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { formatBRL } from '../lib/money'
import { getBookingsGrid, type Booking } from '../lib/api/bookings'
import { listPendingApprovals } from '../lib/api/pendingApprovals'
import { getReport } from '../lib/api/reports'
import { getActiveUnitId } from '../lib/tenantContext'
import { dayWindow } from './Agenda/agendaShared'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import './DashboardPage.css'

/**
 * D3 — Dashboard Admin (BEAC-2096, story BEAC-2051). 4 KPIs compostos a
 * partir de endpoints de reports/bookings/pending-approvals JÁ EXISTENTES
 * (decisão travada, correção 2cff4b09...: nenhum endpoint novo é
 * necessário). "Receita do mês"/"Inadimplência" usam os tipos reais de
 * `ReportType` (`fluxo-de-caixa`/`inadimplencia`) — o texto da task cita
 * nomes placeholder (`revenue`/`delinquency`) que não existem no backend,
 * decisão desta implementação documentada no plano salvo. `period` omitido
 * em `getReport`: o backend já assume o mês corrente quando ausente (ver
 * comentário de pacote de `reports.ts`). Única busca de bookings de hoje
 * alimenta tanto o KPI "Aulas hoje" quanto a lista de agenda resumida (AC:
 * nenhuma chamada duplicada). `unitId` via `getActiveUnitId()` — mesmo
 * padrão de auto-resolução de D2Dashboard/D3FDashboard.
 */
export default function D3Dashboard() {
  const { orgLabel, userLabel } = useShellIdentity()
  const unitId = getActiveUnitId()
  const [revenue, setRevenue] = useState<number | null>(null)
  const [delinquency, setDelinquency] = useState<number | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    if (!unitId) return
    let cancelled = false

    getReport(unitId, 'fluxo-de-caixa').then((result) => {
      if (!cancelled && result.ok) setRevenue(result.report.cashFlow?.summary.receita ?? null)
    })
    getReport(unitId, 'inadimplencia').then((result) => {
      if (!cancelled && result.ok) setDelinquency(result.report.delinquency?.summary.totalAmount ?? null)
    })
    const { from, to } = dayWindow(new Date())
    getBookingsGrid(unitId, from, to).then((result) => {
      if (!cancelled && result.ok) setBookings(result.bookings)
    })
    listPendingApprovals(unitId, 'pending').then((result) => {
      if (!cancelled && result.ok) setPendingCount(result.items.length)
    })

    return () => {
      cancelled = true
    }
  }, [unitId])

  const sortedBookings = useMemo(
    () => bookings.slice().sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [bookings],
  )

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <main className="dashboard-page">
        <h1>Dashboard</h1>

        <div className="dash-body">
          <section data-testid="dashboard-kpis" className="stat4">
            <StatCard label="Receita do mês" value={revenue !== null ? formatBRL(revenue) : '—'} />
            <StatCard label="Inadimplência" value={delinquency !== null ? formatBRL(delinquency) : '—'} />
            <StatCard label="Aulas hoje" value={String(sortedBookings.length)} />
            <StatCard label="Pendências" value={pendingCount !== null ? String(pendingCount) : '—'} />
          </section>

          {unitId ? (
            <section data-testid="dashboard-quick-actions">
              <Link className="btn btn-ghost" to={`/units/${unitId}/agenda`}>
                Agenda
              </Link>
              <Link className="btn btn-ghost" to={`/units/${unitId}/reports`}>
                Relatórios
              </Link>
              <Link className="btn btn-ghost" to={`/units/${unitId}/members`}>
                Membros
              </Link>
            </section>
          ) : null}

          <section data-testid="dashboard-agenda">
            <Card>
              {sortedBookings.length === 0 ? <p className="hint">Nenhuma aula hoje.</p> : null}
              <ul>
                {sortedBookings.map((b) => (
                  <li key={b.id}>{b.className ?? 'Aula particular'}</li>
                ))}
              </ul>
            </Card>
          </section>

          {unitId ? <PendingApprovalsCard unitId={unitId} /> : null}
        </div>
      </main>
    </AppShell>
  )
}
