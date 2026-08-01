/**
 * Contador de notificações não lidas do badge do sino
 * (../components/AppShell/AppShell.tsx), lido da query compartilhada em
 * ../lib/query/notifications.ts.
 *
 * Best-effort por contrato (BEAC-2021): enquanto carrega e em QUALQUER falha
 * (rede ou resposta `!ok`) devolve `0`, e o badge simplesmente não aparece —
 * nunca uma tela de erro, nunca um travamento da casca. É exatamente o que o
 * `useState(0)` + `.catch()` vazio de antes fazia; só o motor mudou.
 */
import { useQuery } from '@tanstack/react-query'
import { unreadNotificationCountQueryOptions } from '../lib/query/notifications'

export function useUnreadNotificationCount(): number {
  const query = useQuery(unreadNotificationCountQueryOptions())
  return query.data ?? 0
}
