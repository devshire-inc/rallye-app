/**
 * Queries dos DADOS GLOBAIS de identidade — `GET /me`, `GET /me/memberships`
 * e `GET /me/permissions`. São os únicos três dados do app migrados para o
 * TanStack Query (ver ./queryClient.ts); todo o resto continua com `fetch`
 * em `useEffect`.
 *
 * Este módulo é a fonte ÚNICA das chaves e das `queryOptions` desses três —
 * ninguém deve montar uma chave de identidade à mão, sob pena de criar uma
 * segunda entrada de cache e ressuscitar exatamente a duplicação de
 * requisições que esta camada elimina.
 *
 * Consumidores:
 *   - ../../hooks/useShellIdentity.ts  (me + memberships)
 *   - ../../context/PermissionsContext.tsx (permissions)
 *   - ../../hooks/useMe.ts (hook de leitura de `me` para as páginas que
 *     antes chamavam `getMe()` direto por cima do useShellIdentity)
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { listMyMemberships, type MembershipListItem } from '../api'
import { getMe, type ApiFailure, type GetMeResult, type GetMeSuccess } from '../api/me'
import { fetchMePermissions, type PermissionsResult } from '../api/permissions'

/**
 * Namespace próprio (`identity`) em vez de espelhar os paths HTTP: a
 * invalidação por prefixo `identityKeys.all` precisa atingir os três de uma
 * vez na troca de arena, e um prefixo compartilhado com queries futuras de
 * outros domínios derrubaria cache que não tem nada a ver com identidade.
 */
export const identityKeys = {
  all: ['identity'] as const,
  me: ['identity', 'me'] as const,
  memberships: ['identity', 'memberships'] as const,
  permissions: ['identity', 'permissions'] as const,
}

/** Falha de `GET /me` (resposta `!ok` ou erro de rede) transportada como
 * exceção — ver `meQueryOptions` abaixo para o porquê. */
export class MeUnavailableError extends Error {
  readonly failure: ApiFailure

  constructor(failure: ApiFailure) {
    super(`GET /me failed: ${failure.error}`)
    this.name = 'MeUnavailableError'
    this.failure = failure
  }
}

const NETWORK_FAILURE: ApiFailure = { ok: false, status: 0, error: 'network_error' }

/**
 * `GET /me`.
 *
 * A queryFn LANÇA quando a resposta é `!ok` de propósito. `getMe()` devolve
 * `{ ok: false, ... }` sem lançar, e se isso virasse um resultado de sucesso
 * do react-query, um 401/403 transitório ficaria cacheado como "dado bom"
 * pelos 5 minutos de staleTime — nenhuma tela conseguiria se recuperar sem
 * uma invalidação manual. Como erro, o react-query não aplica staleTime:
 * a próxima montagem tenta de novo.
 *
 * `retry: false` (contra o default global de 1): `useShellIdentity` promete
 * `loading: false` em QUALQUER desfecho terminal, e um retry mantém a query
 * em `pending` por mais um round-trip. O comportamento anterior do hook era
 * um `.catch()` seco, sem retry — preservado aqui.
 */
export function meQueryOptions() {
  return queryOptions<GetMeSuccess>({
    queryKey: identityKeys.me,
    queryFn: async () => {
      const result = await getMe()
      if (!result.ok) throw new MeUnavailableError(result)
      return result
    },
    retry: false,
  })
}

/**
 * `GET /me/memberships`. `listMyMemberships` já lança em resposta `!ok`
 * (ListMembershipsError), então não há nada a traduzir aqui.
 *
 * `retry: false` pelo mesmo motivo de `meQueryOptions` — este é o endpoint
 * caro (~2,4s medidos), e prender a shell num segundo round-trip é
 * exatamente o que se quer evitar.
 */
export function membershipsQueryOptions() {
  return queryOptions<MembershipListItem[]>({
    queryKey: identityKeys.memberships,
    queryFn: listMyMemberships,
    retry: false,
  })
}

/**
 * `GET /me/permissions`. NÃO tem `enabled` embutido: quem monta decide
 * quando pode buscar — o PermissionsProvider só habilita depois de
 * SESSION_ESTABLISHED_EVENT (ver comentário de pacote lá), preservando o
 * estado `idle` de antes do primeiro fetch.
 */
export function permissionsQueryOptions() {
  return queryOptions<PermissionsResult>({
    queryKey: identityKeys.permissions,
    queryFn: fetchMePermissions,
    retry: false,
  })
}

/**
 * Lê `GET /me` do cache, buscando uma única vez se ainda não houver nada —
 * versão awaitable e deduplicada de `getMe()`, com o MESMO contrato de
 * retorno (`GetMeResult`, nunca lança).
 *
 * Existe para as telas cujo carregamento é uma cadeia de promises
 * (`getMe().then(id => …)`, ex.: PL4/PL5/MyEarnings): elas trocam a chamada
 * direta por esta sem reescrever o fluxo, e param de emitir um segundo
 * `GET /me` por cima do que o `useShellIdentity` da mesma tela já buscou.
 */
export async function ensureMe(queryClient: QueryClient): Promise<GetMeResult> {
  try {
    return await queryClient.ensureQueryData(meQueryOptions())
  } catch (error) {
    return error instanceof MeUnavailableError ? error.failure : NETWORK_FAILURE
  }
}

/**
 * Invalida os TRÊS dados de identidade de uma vez. Chamado na troca de
 * arena (S1Page/TrocarArenaPage): `me/memberships` muda (`last_accessed_at`)
 * e, principalmente, o papel/permissions passam a ser os da NOVA unit — sem
 * isso o usuário veria o rótulo e o gating da arena anterior.
 *
 * Não devolve promise aguardável de propósito nos call sites: quem PRECISA
 * esperar são as permissions, e esse contrato é cumprido pelo
 * `refetch()` do PermissionsContext (awaitable), não por esta função.
 *
 * Incluir `permissions` aqui NÃO duplica a requisição que o `refetch()`
 * chamado logo em seguida dispara: as duas apontam para a mesma chave, e o
 * react-query colapsa fetches concorrentes da mesma chave num só.
 */
export function invalidateIdentity(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: identityKeys.all })
}
