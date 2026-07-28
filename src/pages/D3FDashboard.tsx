import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell/AppShell'
import { Card } from '../components/ui/Card/Card'
import { usePermission } from '../hooks/usePermission'
import { useShellIdentity } from '../hooks/useShellIdentity'
import { visibleD3FSections } from '../lib/d3fSections'
import { getActiveUnitId } from '../lib/tenantContext'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import './DashboardPage.css'

/**
 * D3F — Dashboard Funcionário (BEAC-2094, story BEAC-1737): papel
 * customizado (detectado por exclusão em `resolveDashboardVariant`, ver
 * `dashboardTarget.ts`). Cada seção de módulo é gated 1:1 por
 * `usePermission(modulo,'read')` (`visibleD3FSections`, `../lib/
 * d3fSections.ts`) — `alunos` e `quadras` ficam de fora (nenhum dos dois
 * tem hoje uma rota real que funcione para quem só tem `read`, decisão
 * documentada na memória de implementação desta task); `loja` fica de fora
 * por decisão de produto travada (nunca aparece em nenhum nav). `unitId`
 * resolvido via `getActiveUnitId()` (não props/useParams) — mesmo padrão de
 * auto-resolução de `D1Dashboard`/`ProfilePage`, consistente com a
 * interface "sem props obrigatórias" da task.
 */
export default function D3FDashboard() {
  const { orgLabel, userLabel } = useShellIdentity()
  const unitId = getActiveUnitId()

  const access = {
    professores: usePermission('professores', 'read'),
    agenda: usePermission('agenda', 'read'),
    financeiro: usePermission('financeiro', 'read'),
    torneios: usePermission('torneios', 'read'),
    config: usePermission('config', 'read'),
    relatorios: usePermission('relatorios', 'read'),
  }

  const sections = unitId ? visibleD3FSections(access, unitId) : []

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <main className="dashboard-page">
        <h1>Dashboard</h1>

        <div className="dash-body">
          {sections.map((section) => (
            <section key={section.module} data-testid={`dashboard-section-${section.module}`}>
              <Card>
                <Link to={section.path}>{section.label}</Link>
              </Card>
            </section>
          ))}

          {unitId ? <PendingApprovalsCard unitId={unitId} /> : null}
        </div>
      </main>
    </AppShell>
  )
}
