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
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchMePermissions } from '../lib/api/permissions'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
import { PermissionsContext, type PermissionsState } from './permissionsContextInstance'

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PermissionsState>({ status: 'idle' })

  const refetch = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const result = await fetchMePermissions()
      if (result.kind === 'temporary') {
        setState({ status: 'ready', kind: 'temporary' })
      } else {
        setState({ status: 'ready', kind: 'full', permissions: result.permissions })
      }
    } catch {
      // Esconder sempre: uma falha ao buscar permissions nunca deve virar
      // "liberado por omissão" — cai num estado explícito que
      // usePermission trata como false para tudo.
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    function handleSessionEstablished() {
      void refetch()
    }
    window.addEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
    return () => window.removeEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
  }, [refetch])

  return (
    <PermissionsContext.Provider value={{ state, refetch }}>{children}</PermissionsContext.Provider>
  )
}
