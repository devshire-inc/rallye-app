import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar/Avatar'
import { MenuRow } from '../../components/ui/ListRow/MenuRow'
import LogoutButton from '../../components/LogoutButton'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { useMe } from '../../hooks/useMe'
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
 * "Configurações" (grupo "Conta") deixou de ser inerte com BEAC-2035 (story
 * BEAC-1727, Épico 10) — aponta pra PF5/SettingsPage.tsx (`/configuracoes`,
 * escopo mínimo: só a seção "Notificações" do protótipo PF5, ver comentário
 * de pacote lá). "Editar perfil" e "Notificações" continuam inertes —
 * "Editar perfil" é PF4 (fora de escopo de qualquer story até agora) e
 * "Notificações" aqui se refere a uma tela ainda não mapeada por nenhuma
 * story (N1/Centro de Notificações, BEAC-1723, já existe em `/notificacoes`,
 * mas nenhuma story pediu explicitamente pra ligar este item de menu a ela
 * — decisão deixada pra quando essa lacuna for endereçada, pra não
 * expandir o escopo desta task silenciosamente).
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
 *
 * Reskin (BEAC-2093-family, Figma node 36:1154 mobile / 100:2632 desktop)
 * sobre o design system: `Avatar` para o cabeçalho de identidade (nome real
 * via `GET /me`, já que `useShellIdentity` só expõe `userLabel` combinado
 * "{nome} · {papel}") e `MenuRow` para as linhas de menu — troca o shim
 * local `MenuRow` (ad-hoc, `.chev-note`) que existia só por não ter o
 * componente real do DS ainda. Rotas preservadas 1:1, agora disparadas via
 * `useNavigate` (MenuRow não aceita `to`/Link, só `onClick`) em vez de
 * `<Link>`. Linhas inertes preservam o texto "outra story" que já existia
 * (agora no slot `value` do MenuRow, que substitui o chevron quando
 * presente). Gap de dado real e decisões de escopo do reskin documentados
 * em /tmp/profile-builder-summary.md — a Figma "Perfil — Aluno" mostra
 * cartão de gamificação (medalha/XP/tier) e conquistas que esta tela (PF3,
 * admin/dono) não tem: nenhum dado de aluno é buscado aqui, então nada foi
 * inventado.
 */
export default function ProfilePage() {
  const navigate = useNavigate()
  const { orgLabel, role } = useShellIdentity()
  // O nome cru vem da MESMA entrada de cache de `GET /me` que o
  // `useShellIdentity` acima já lê (ele só expõe o `userLabel` combinado
  // "{nome} · {papel}") — antes esta tela pagava um segundo fetch por isso.
  const { me } = useMe()
  const fullName = me?.fullName ?? ''
  const tenantId = getActiveTenantId()
  const unitId = getActiveUnitId()

  const subtitle = [role, orgLabel].filter(Boolean).join(' · ')

  return (
    <>
      <div className="profile-page">
      <div className="prof-head">
        <Avatar name={fullName} size="lg" />
        <div className="ph-main">
          <h1>{fullName || 'Minha conta'}</h1>
          <div className="mt">{subtitle || 'Perfil e configurações'}</div>
        </div>
      </div>
      <div className="dash-body">
        <div>
          <div className="set-title">Gestão</div>
          <div className="menu-list">
            {unitId ? (
              <MenuRow
                label="Configurações da arena"
                onClick={() => navigate(`/units/${unitId}/settings`)}
                testId="menu-config-arena"
              />
            ) : (
              <MenuRow label="Configurações da arena" value="outra story" testId="menu-config-arena" />
            )}
            <MenuRow label="Quadras" value="outra story" />
            {unitId ? (
              <MenuRow
                label="Papéis e permissões"
                onClick={() => navigate(`/units/${unitId}/roles`)}
                testId="menu-papeis-permissoes"
              />
            ) : (
              <MenuRow label="Papéis e permissões" value="outra story" testId="menu-papeis-permissoes" />
            )}
            {unitId ? (
              <MenuRow
                label="Membros e papéis"
                onClick={() => navigate(`/units/${unitId}/members`)}
                testId="menu-membros-papeis"
              />
            ) : (
              <MenuRow label="Membros e papéis" value="outra story" testId="menu-membros-papeis" />
            )}
            <MenuRow
              label="Minhas unidades"
              onClick={() => navigate(`/tenants/${tenantId ?? 'unknown'}/units`)}
              testId="menu-minhas-unidades"
            />
          </div>
          <p className="hint">
            "Minhas unidades" sempre aparece pro Tenant Owner, mesmo com 1 unidade só — nunca fica
            sem caminho pra criar a 2ª.
          </p>
        </div>
        <div>
          <div className="set-title">Conta</div>
          <div className="menu-list">
            <MenuRow label="Editar perfil" value="outra story" />
            <MenuRow label="Notificações" value="outra story" />
            <MenuRow
              label="Configurações"
              onClick={() => navigate('/configuracoes')}
              testId="menu-configuracoes"
            />
          </div>
        </div>
        <LogoutButton />
        <div className="foot-note">Rallye v1.0.0</div>
      </div>
      </div>
    </>
  )
}
