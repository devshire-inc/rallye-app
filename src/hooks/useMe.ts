/**
 * Leitura do `GET /me` compartilhado (../lib/query/identity.ts).
 *
 * Existe porque 10 telas usavam `useShellIdentity()` E chamavam `getMe()`
 * direto num `useEffect` por cima — `useShellIdentity` expõe `userLabel`
 * ("{nome} · {papel}"), mas não o `id` nem o `fullName` cru, então cada uma
 * dessas telas pagava um segundo `GET /me` só para obtê-los. Este hook lê a
 * MESMA entrada de cache que o `useShellIdentity` já preenche: zero
 * requisição adicional.
 *
 * Regra: nenhuma tela deve voltar a chamar `getMe()` diretamente. Se um
 * campo novo de `/me` for necessário, ele sai daqui — não de um fetch novo.
 */
import { useQuery } from '@tanstack/react-query'
import { meQueryOptions } from '../lib/query/identity'
import type { GetMeSuccess } from '../lib/api/me'

export interface UseMeResult {
  /** Perfil do usuário logado, ou `null` enquanto carrega e em qualquer
   * falha (erro de rede ou resposta `!ok`, ex.: o 403 que o backend devolve
   * para sessão `temporary`/Visitante). */
  me: GetMeSuccess | null
  /** `true` só enquanto o `GET /me` está em voo. */
  loading: boolean
  /**
   * `true` assim que o `GET /me` chega a QUALQUER desfecho terminal —
   * sucesso ou falha. É o equivalente do `identityResolved` que AG3/AG4
   * mantinham à mão: `me === null` sozinho é ambíguo (ainda não sei × este
   * usuário não tem perfil acessível), e quem só escopa uma busca por
   * `me.id` precisa saber quando pode seguir sem ele.
   */
  settled: boolean
  /** `true` quando o `GET /me` terminou em falha. */
  failed: boolean
}

export function useMe(): UseMeResult {
  const query = useQuery(meQueryOptions())

  return {
    me: query.data ?? null,
    loading: query.isPending,
    settled: !query.isPending,
    failed: query.isError,
  }
}
