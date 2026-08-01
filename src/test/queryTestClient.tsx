/**
 * Provider de teste para o TanStack Query.
 *
 * Desde que os dados globais de identidade (`/me`, `/me/memberships`,
 * `/me/permissions`) viraram queries (../lib/query/identity.ts), qualquer
 * árvore que contenha `useShellIdentity`, `useMe` ou o `PermissionsProvider`
 * precisa de um `QueryClient` em contexto — sem ele o render lança
 * "No QueryClient set".
 *
 * Este arquivo exporta SÓ o componente (exigido pelo eslint
 * react-refresh/only-export-components, mesma separação já adotada entre
 * ../context/PermissionsContext.tsx e ../context/permissionsContextInstance.ts).
 * O helper de render que o embrulha vive em ./renderWithQuery.tsx.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Um client NOVO por render — o cache é global por instância, então
 * reaproveitar um faria o resultado de um teste vazar para o seguinte (o
 * segundo leria `/me` do cache do primeiro em vez do mock que ele montou).
 *
 * `retry: false`: uma falha mockada precisa virar estado de erro na hora, sem
 * o backoff do default. `gcTime: Infinity`: nada expira no meio de um teste.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
}

/** Wrapper pronto para a opção `wrapper` de `renderHook` e para compor com
 * outros providers. Cria o próprio client. */
export function QueryTestProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
}
