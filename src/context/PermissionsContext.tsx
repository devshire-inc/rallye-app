/**
 * PermissionsContext (BEAC-1841, story BEAC-1683) — cache global das
 * permissions do usuário corrente, alimentado por GET /me/permissions
 * (BEAC-1840). É a fonte de dados síncrona lida pelo hook `usePermission`
 * (../hooks/usePermission.ts) — nenhum componente de feature deve chamar
 * `fetchMePermissions` diretamente.
 *
 * Quando buscar (ver useEffect abaixo):
 *   - Sempre que uma sessão é estabelecida (login ou o refresh-no-boot de
 *     `checkExistingSession`) — httpClient.ts dispara
 *     `SESSION_ESTABLISHED_EVENT` nesse momento (ver comentário lá), e este
 *     Provider escuta o evento para não acoplar httpClient.ts (livre de
 *     React) a nenhum estado de UI.
 *   - Sempre que o usuário troca de unit ativa — quem dispara isso
 *     explicitamente é a tela que faz a troca (S1Page.enterMembership,
 *     BEAC-1835/1834), chamando `refetch()` (exposto por
 *     `usePermissionsContext`, ../hooks/usePermissionsContext.ts) e
 *     AGUARDANDO a Promise ANTES de navegar (AC de BEAC-1841: "re-buscar
 *     /me/permissions e atualizar o contexto antes de qualquer tela da
 *     nova unit renderizar") — um evento fire-and-forget não bastaria
 *     aqui, porque não haveria como a tela de destino esperar o fetch
 *     terminar antes de montar.
 *
 * Postura "esconder sempre, nunca desabilitar": o estado inicial (`idle`,
 * antes do primeiro fetch) e qualquer falha de rede (`error`) fazem
 * `usePermission` devolver `false` para tudo — nunca existe um estado
 * "liberado por omissão" enquanto o mapa real não chegou.
 *
 * A instância do Context (React.Context em si) e os tipos de estado vivem
 * em ./permissionsContextInstance.ts, e o hook de leitura em
 * ../hooks/usePermissionsContext.ts — este arquivo só exporta o componente
 * Provider (exigido pelo eslint react-refresh/only-export-components).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { permissionsQueryOptions } from '../lib/query/identity'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
import { PermissionsContext, type PermissionsState } from './permissionsContextInstance'

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  /**
   * A query fica DESABILITADA até a primeira sessão ser estabelecida (ou
   * até alguém chamar `refetch()` explicitamente). Isso preserva ao pé da
   * letra a regra (a) do comentário de pacote: este Provider nunca buscou
   * permissions na montagem — só ao receber SESSION_ESTABLISHED_EVENT — e
   * o estado antes disso é `idle`, que `usePermission` lê como "false para
   * tudo".
   */
  const [enabled, setEnabled] = useState(false)

  const query = useQuery({ ...permissionsQueryOptions(), enabled })

  /**
   * Regra (b): `refetch()` continua AWAITABLE, e continua sendo o que
   * S1Page.enterMembership/TrocarArenaPage aguardam antes de navegar — o
   * contrato é que nenhuma tela da nova unit renderize antes das permissions
   * novas chegarem.
   *
   * Usa `fetchQuery` e não o `refetch` do `useQuery` por duas razões
   * concretas: (1) `fetchQuery` funciona mesmo com a query ainda
   * desabilitada, então a primeira chamada não depende da ordem em que o
   * evento de sessão chegou; (2) `staleTime: 0` força ida à rede de
   * verdade — numa troca de arena, devolver o mapa cacheado da unit
   * ANTERIOR seria justamente o bug que este await existe para impedir.
   *
   * A promise resolve depois que o resultado já está escrito no cache, e é
   * o mesmo cache que o `useQuery` acima observa — quando o await retorna,
   * o `state` exposto no contexto já reflete as permissions novas.
   */
  const refetch = useCallback(async () => {
    setEnabled(true)
    try {
      await queryClient.fetchQuery({ ...permissionsQueryOptions(), staleTime: 0 })
    } catch {
      // Esconder sempre: uma falha ao buscar permissions nunca deve virar
      // "liberado por omissão". O erro já está registrado no cache da query
      // e vira `status: 'error'` no mapeamento abaixo, que `usePermission`
      // trata como false para tudo — aqui só impedimos que a rejeição
      // escape para o chamador, que apenas aguarda ("terminou de tentar"),
      // não trata falha.
    }
  }, [queryClient])

  useEffect(() => {
    function handleSessionEstablished() {
      void refetch()
    }
    window.addEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
    return () => window.removeEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
  }, [refetch])

  /**
   * Mapeia o estado da query para o `PermissionsState` que o contexto
   * sempre expôs — a forma pública não mudou.
   *
   * A ordem dos ramos importa: `data` vem ANTES de `fetching`, então um
   * refetch em segundo plano (revalidação por foco, ver
   * ../lib/query/platformBridge.ts) mantém as permissions atuais visíveis
   * em vez de piscar tudo para escondido. Nas transições que importam para
   * o AC — primeira carga e troca de arena — não há divergência: na
   * primeira não existe `data`, e na troca a navegação só acontece depois
   * do await acima.
   */
  const state = useMemo<PermissionsState>(() => {
    if (query.data) {
      return query.data.kind === 'temporary'
        ? { status: 'ready', kind: 'temporary' }
        : { status: 'ready', kind: 'full', permissions: query.data.permissions }
    }
    if (query.isError) return { status: 'error' }
    if (query.fetchStatus === 'fetching') return { status: 'loading' }
    return { status: 'idle' }
  }, [query.data, query.isError, query.fetchStatus])

  const value = useMemo(() => ({ state, refetch }), [state, refetch])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}
