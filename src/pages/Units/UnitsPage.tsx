import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { loadUnits } from '../../lib/unitsLocalStore'
import '../../components/AuthLayout/AuthLayout.css'
import './UnitsPage.css'

/**
 * OW2 — Minhas unidades (BEAC-1832). Markup segue scr-ow2 do protótipo real
 * ("Rallye — Perfil & Config · Saque Noturno"): cabeçalho com contagem +
 * botão "Nova unidade" (-> OW3), lista de cards de unit.
 *
 * Fonte de dados: ver src/lib/unitsLocalStore.ts — não há endpoint de
 * listagem real nesta story (só POST, BEAC-1831), então a "matriz" é um
 * dado de demonstração rotulado como tal; qualquer unit criada de fato via
 * OW3 aparece aqui com dados reais (id/name da resposta do POST).
 *
 * Tocar numa unit: navegação stub para /dashboard (AC permite
 * stub/placeholder — D3/OW1, o dashboard admin real da unit, é de outro
 * épico).
 */
export default function UnitsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  // sessionStorage é lido direto no corpo do componente (não via
  // useState+useEffect): a lista só muda entre navegações completas de rota
  // (voltando de OW3 após criar uma unit), então não há "sincronização com
  // sistema externo" contínua a fazer aqui — só uma leitura pura por render,
  // o padrão recomendado pelo eslint react-hooks (evitar setState em efeito
  // quando o valor pode ser derivado direto no render).
  const units = tenantId ? loadUnits(tenantId) : []

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Minhas unidades</h1>
        <span className="count">{units.length}</span>
        <div className="spacer" />
        <Link className="btn btn-primary btn-sm" to={`/tenants/${tenantId}/units/new`}>
          + Nova unidade
        </Link>
      </div>
      <div className="dash-body">
        {units.map((unit, index) => (
          <button
            key={unit.id}
            type="button"
            className="unit-card"
            onClick={() => navigate('/dashboard')}
          >
            <div className="uc-img">{unit.name.slice(0, 2).toUpperCase()}</div>
            <div className="uw">
              <div className="un">
                {unit.name}
                {index === 0 ? ' (matriz)' : ''}
              </div>
              <div className="um">
                {unit.isSeed ? (
                  <span className="badge badge-muted">dado de demonstração</span>
                ) : (
                  <span className="badge badge-success">Ativa</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  )
}
