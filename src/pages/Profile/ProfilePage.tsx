import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import LogoutButton from '../../components/LogoutButton'
import { getActiveTenantId, getActiveUnitId } from '../../lib/tenantContext'
import '../../components/AuthLayout/AuthLayout.css'
import './ProfilePage.css'

/**
 * PF3 — Perfil (admin/dono), shell mínima (BEAC-1832, decisão 4 do
 * relatório de execução de BEAC-1680). Markup segue scr-pf3 do protótipo
 * real ("Rallye — Perfil & Config · Saque Noturno"): cabeçalho de perfil +
 * dois grupos de menu (Gestão / Conta). Escopo mínimo: só os itens que já
 * têm destino real nesta story (Minhas unidades -> OW2, Papéis e permissões
 * -> C3/RolesPage, BEAC-1843, e Membros e papéis -> MembersPage, BEAC-1845)
 * ou que fazem sentido como placeholder ficam aqui — Quadras (C2) é de
 * outra story e continua inerte. Não há item "Histórico" aqui: essa aba
 * (BEAC-1848) vive dentro de C3/RolesPage, ao lado de "Papéis" — na
 * reconciliação do épico, um item de menu PF3 separado (existente antes só
 * porque BEAC-1687 foi construída num branch isolado sem visibilidade da
 * estrutura de abas de BEAC-1684) foi removido em favor de consolidar as
 * duas abas na mesma tela, como o protótipo sempre desenhou.
 *
 * "Configurações da arena" (C1) deixou de ser inerte com BEAC-1867 (story
 * BEAC-1694, "Configuração dos 3 níveis de bloqueio por inadimplência") —
 * mesmo padrão condicional a `getActiveUnitId()` de "Papéis e permissões"/
 * "Membros e papéis" logo abaixo. C1 em si segue mínima (só a seção
 * "Bloqueio por inadimplência" — Dados/Regras de agendamento são de outras
 * stories, ainda não construídas), então o link aponta pra essa tela
 * mínima, não pro C1 completo do protótipo.
 *
 * "Membros e papéis" (BEAC-1845, story BEAC-1686): entrada escolhida por
 * essa task para a tela de membros/atribuição de papel — decisão explícita
 * (a task deixa em aberto "aba Papéis em C3 ou novo item em PF3"; a
 * reconciliação deste épico manteve os dois itens separados, diferente do
 * que aconteceu com "Histórico", porque BEAC-1845 nunca teve uma aba
 * correspondente já construída dentro de C3/RolesPage esperando por ela —
 * ver comentário de pacote em MembersPage.tsx). Mesmo padrão condicional de
 * "Minhas unidades"/`getActiveTenantId`: só vira link real quando há uma
 * unit ativa conhecida (`getActiveUnitId`), senão fica inerte — evita link
 * morto.
 *
 * "Minhas unidades" (decisão 4): deveria aparecer só para o Tenant Owner —
 * mas o rallye-app ainda não tem, hoje, nenhuma forma de saber o papel do
 * usuário logado nem de qual tenant (ver src/lib/tenantContext.ts, mesmo
 * gap reportado no relatório de execução). Por isso o item é sempre
 * mostrado aqui (igual ao protótipo, que também sempre mostra pra Tenant
 * Owner) — a gate real de "só se for Tenant Owner" fica pendente da mesma
 * decisão de arquitetura. "Papéis e permissões" (BEAC-1843) e "Membros e
 * papéis" (BEAC-1845) herdam a mesma limitação: sempre mostrados, sem gate
 * por permission real ainda (o próprio backend, via
 * middleware.TenantContextForUnit + config:write/config:read, é quem
 * efetivamente barra quem não pode — a UI só evita link morto quando há
 * unit ativa). "Configurações da arena" (C1, BEAC-1867) é diferente: a
 * própria ArenaSettingsPage já faz o gate real via `usePermission('config',
 * ...)` (Épico 3) — este item de menu, como os outros, só evita link morto
 * (gate por `unitId`); quem não tem `config:read` ainda vê o link aqui, mas
 * a seção em si não renderiza nada ao entrar.
 */
export default function ProfilePage() {
  const tenantId = getActiveTenantId()
  const unitId = getActiveUnitId()

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
            {unitId ? (
              <Link
                className="menu-row"
                to={`/units/${unitId}/settings`}
                data-testid="menu-config-arena"
              >
                <span>Configurações da arena</span>
                <span className="chev">›</span>
              </Link>
            ) : (
              <MenuRow label="Configurações da arena" />
            )}
            <MenuRow label="Quadras" />
            {unitId ? (
              <Link
                className="menu-row"
                to={`/units/${unitId}/roles`}
                data-testid="menu-papeis-permissoes"
              >
                <span>Papéis e permissões</span>
                <span className="chev">›</span>
              </Link>
            ) : (
              <MenuRow label="Papéis e permissões" />
            )}
            {unitId ? (
              <Link
                className="menu-row"
                to={`/units/${unitId}/members`}
                data-testid="menu-membros-papeis"
              >
                <span>Membros e papéis</span>
                <span className="chev">›</span>
              </Link>
            ) : (
              <MenuRow label="Membros e papéis" />
            )}
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
