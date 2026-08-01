/**
 * QueryClient global do app (TanStack Query) — camada de cache/dedupe dos
 * DADOS GLOBAIS de identidade (`/me`, `/me/memberships`, `/me/permissions`).
 *
 * Por que isto existe: `useShellIdentity` era um hook por instância
 * (`useState` + `useEffect(…, [])`), então CADA componente que o chamava
 * disparava os próprios fetches. Numa única navegação ao dashboard isso
 * rendia 10 × `GET /me` e 8 × `GET /me/memberships` (AppShell +
 * DashboardPage + a variante D1/D2/… cada um chamando o hook, mais as
 * páginas que ainda chamavam `getMe()` direto por cima). Com o QueryClient,
 * chamadas concorrentes da MESMA chave colapsam numa só requisição em voo, e
 * as subsequentes leem do cache.
 *
 * ATENÇÃO DE ESCOPO: só os três dados globais acima estão migrados. As
 * demais ~68 páginas continuam com `fetch` em `useEffect` e migram no
 * futuro, conforme forem tocadas.
 */
import { QueryClient } from '@tanstack/react-query'

/**
 * 5 minutos. A API está longe do banco e cada requisição é cara (o
 * `/me/memberships` medido custava ~2,4s), enquanto os dados de identidade —
 * nome do usuário, arenas em que ele tem membership, papel — praticamente
 * não mudam dentro de uma sessão. Uma janela de frescor generosa é o que
 * transforma navegação entre telas em leitura de cache em vez de round-trip.
 *
 * O risco normal de um staleTime alto (mostrar dado velho depois de uma
 * mudança) está coberto por invalidação EXPLÍCITA nos dois únicos momentos
 * em que a identidade realmente muda: sessão estabelecida
 * (SESSION_ESTABLISHED_EVENT) e troca de arena (ver ./identity.ts,
 * `invalidateIdentity`). Ou seja: o cache não é uma aposta no relógio, o
 * relógio é só a rede de segurança.
 */
const IDENTITY_STALE_TIME_MS = 5 * 60 * 1000

/**
 * 30 minutos — bem acima do staleTime de propósito. `gcTime` é quanto tempo
 * um dado SEM nenhum observador sobrevive no cache antes de ser descartado.
 * Como o app desmonta/remonta as telas a cada navegação de rota, um gcTime
 * curto faria a identidade ser coletada no intervalo entre uma tela sair e a
 * próxima entrar — e a tela seguinte pagaria o fetch de novo, justamente o
 * problema que esta camada existe pra resolver.
 */
const IDENTITY_GC_TIME_MS = 30 * 60 * 1000

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: IDENTITY_STALE_TIME_MS,
        gcTime: IDENTITY_GC_TIME_MS,
        // Uma tentativa extra, não as 3 do default: as requisições são caras
        // e o usuário sente cada retry como tela parada.
        retry: 1,
        // `refetchOnWindowFocus` fica no default (true) DE PROPÓSITO: é ele
        // que revalida a identidade quando o usuário volta ao app depois de
        // um tempo. Em WebView o `window.focus` do navegador não é
        // confiável, então o sinal de foco é reescrito para o
        // `appStateChange` do Capacitor — ver ./platformBridge.ts.
        // Combinado com o staleTime acima, um foco não gera requisição
        // nenhuma enquanto o dado estiver fresco.
      },
    },
  })
}

/** Instância única do app (montada em App.tsx). Testes que precisem de
 * isolamento devem criar a própria via `createAppQueryClient()`. */
export const appQueryClient = createAppQueryClient()
