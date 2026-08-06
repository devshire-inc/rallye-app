import { Outlet } from 'react-router-dom'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { AppShell } from './AppShell'

/**
 * Rota de layout da casca autenticada — o único lugar do app que monta o
 * `AppShell`. As ~62 rotas com casca vivem debaixo dela em `src/App.tsx` e
 * chegam aqui pelo `<Outlet/>`.
 *
 * ## Por que uma rota de layout
 *
 * Antes, cada página renderizava o próprio `<AppShell>`. Como cada rota é um
 * elemento diferente numa posição diferente da árvore, toda navegação
 * DESMONTAVA e remontava a casca inteira — sidebar, bottom nav e topbar. O
 * sintoma que motivou este refactor: a animação do indicador do `BottomNav`
 * nunca aparecia. Ela é uma `transition` de CSS, e um elemento recém-montado
 * não transiciona: ele nasce já na posição final. No Storybook a animação
 * sempre funcionou porque lá o componente fica montado e só a prop `active`
 * muda. Esta rota reproduz essa condição no app — o `AppShell` é o mesmo
 * elemento na mesma posição da árvore em toda navegação, então o React o
 * reconcilia e o indicador transiciona de onde estava para onde vai.
 *
 * Também é a raiz de dois sintomas que já perseguimos por outros caminhos: a
 * nav piscando na troca de tela e os efeitos de montagem da casca (o
 * `GET /me/notifications/unread-count` do sino) rodando a cada navegação.
 *
 * ## Os rótulos
 *
 * `orgLabel`/`userLabel` eram derivados de `useShellIdentity()` em cada uma
 * das 72 ocorrências, sempre do mesmo jeito. Agora saem daqui uma vez só —
 * o hook é cacheado por react-query (ver ../../lib/query/identity.ts), então
 * isto não muda o número de requisições, só remove a repetição.
 *
 * Páginas que ainda chamam `useShellIdentity()` continuam legítimas: elas
 * usam OUTROS campos (o `role` do dispatcher de dashboard) ou o `orgLabel`
 * no próprio conteúdo (o eyebrow do D1, o "· escolha o esporte" do
 * agendamento) — não é sobra do refactor.
 */
export function AppShellLayout() {
  const { orgLabel, userLabel } = useShellIdentity()

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <Outlet />
    </AppShell>
  )
}
