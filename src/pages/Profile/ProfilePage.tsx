import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import LogoutButton from '../../components/LogoutButton'
import { getActiveTenantId } from '../../lib/tenantContext'
import '../../components/AuthLayout/AuthLayout.css'
import './ProfilePage.css'

/**
 * PF3 — Perfil (admin/dono), shell mínima (BEAC-1832, decisão 4 do
 * relatório de execução de BEAC-1680). Markup segue scr-pf3 do protótipo
 * real ("Rallye — Perfil & Config · Saque Noturno"): cabeçalho de perfil +
 * dois grupos de menu (Gestão / Conta). Escopo mínimo: só os itens que já
 * têm destino real nesta story (Minhas unidades -> OW2) ou que fazem
 * sentido como placeholder ficam aqui — Config da arena (C1), Quadras (C2)
 * e Papéis e permissões (C3) são de outras stories e ficam inertes.
 *
 * "Minhas unidades" (decisão 4): deveria aparecer só para o Tenant Owner —
 * mas o rallye-app ainda não tem, hoje, nenhuma forma de saber o papel do
 * usuário logado nem de qual tenant (ver src/lib/tenantContext.ts, mesmo
 * gap reportado no relatório de execução). Por isso o item é sempre
 * mostrado aqui (igual ao protótipo, que também sempre mostra pra Tenant
 * Owner) — a gate real de "só se for Tenant Owner" fica pendente da mesma
 * decisão de arquitetura.
 */
export default function ProfilePage() {
  const tenantId = getActiveTenantId()

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Perfil">
      <div className="prof-head">
        <div className="avatar-lg">?</div>
        <div className="ph-main">
          <h1>Minha conta</h1>
          <div className="mt">Perfil e configurações</div>
        </div>
      </div>
      <div className="dash-body">
        <div>
          <div className="set-title">Gestão</div>
          <div className="menu-list">
            <MenuRow label="Configurações da arena" />
            <MenuRow label="Quadras" />
            <MenuRow label="Papéis e permissões" />
            <Link
              className="menu-row"
              to={`/tenants/${tenantId ?? 'unknown'}/units`}
              data-testid="menu-minhas-unidades"
            >
              <span>Minhas unidades</span>
              <span className="chev">›</span>
            </Link>
          </div>
          <p className="hint">
            "Minhas unidades" sempre aparece pro Tenant Owner, mesmo com 1 unidade só — nunca fica
            sem caminho pra criar a 2ª.
          </p>
        </div>
        <div>
          <div className="set-title">Conta</div>
          <div className="menu-list">
            <MenuRow label="Editar perfil" />
            <MenuRow label="Notificações" />
            <MenuRow label="Configurações" />
          </div>
        </div>
        <LogoutButton />
        <div className="foot-note">Rallye v1.0.0</div>
      </div>
    </AppShell>
  )
}

function MenuRow({ label }: { label: string }) {
  return (
    <div className="menu-row inert">
      <span>{label}</span>
      <span className="chev-note">outra story</span>
    </div>
  )
}
