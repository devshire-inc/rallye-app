/**
 * Query do contador de notificações não lidas — `GET
 * /me/notifications/unread-count`, o dado que alimenta o badge do sino da
 * shell (../../components/AppShell/AppShell.tsx).
 *
 * Por que ele entra no TanStack Query junto dos dados de identidade (ver
 * ./queryClient.ts): é dado GLOBAL de casca, não de uma tela. O `AppShell`
 * buscava num `useEffect(…, [])` por instância, então qualquer remount da
 * casca (ou duas cascas montadas no mesmo commit) virava uma requisição
 * nova. Compartilhado por chave, N montagens no mesmo commit colapsam numa
 * só e as navegações seguintes leem do cache.
 *
 * Mesma convenção de ./identity.ts: namespace próprio para a chave e
 * `queryOptions` exportada daqui — ninguém monta a chave à mão.
 */
import { queryOptions } from '@tanstack/react-query'
import { getUnreadNotificationCount } from '../api/notifications'

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
}

/**
 * 1 minuto, bem abaixo dos 5 do default global: diferente de nome/arenas/
 * papel, o número de não lidas muda a toda hora (qualquer evento do app pode
 * incrementá-lo). É o suficiente para deduplicar as montagens de uma mesma
 * navegação sem congelar o badge — e, combinado com o `refetchOnWindowFocus`
 * do default, o contador se atualiza quando o usuário volta ao app.
 */
const UNREAD_COUNT_STALE_TIME_MS = 60 * 1000

/**
 * A queryFn LANÇA quando a resposta é `!ok` — mesmo motivo de
 * `meQueryOptions`: um 401/403 transitório cacheado como "dado bom" ficaria
 * preso pelo staleTime. Como erro, a próxima montagem tenta de novo.
 *
 * Quem consome trata a falha como best-effort (badge simplesmente não
 * aparece, ver ../../hooks/useUnreadNotificationCount.ts) — o contrato
 * original do sino, preservado.
 *
 * `retry: false` (contra o default global de 1): o comportamento anterior
 * era um `.catch()` seco, sem retry, e um badge é decoração — não vale um
 * segundo round-trip.
 */
export function unreadNotificationCountQueryOptions() {
  return queryOptions<number>({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const result = await getUnreadNotificationCount()
      if (!result.ok) throw new Error(`GET /me/notifications/unread-count failed: ${result.error}`)
      return result.unreadCount
    },
    staleTime: UNREAD_COUNT_STALE_TIME_MS,
    retry: false,
  })
}
