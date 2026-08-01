import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../lib/api/notifications'
import { formatRelativeTimestamp } from '../../lib/formatRelativeTimestamp'
import { groupNotificationsByRecency } from '../../lib/groupNotifications'
import { resolveNotificationRoute } from '../../lib/notificationRouting'
import '../../components/AuthLayout/AuthLayout.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './N1Page.css'

const PAGE_SIZE = 20

/** Emoji temático por `type` (sem lib de ícones no repo — mesmo placeholder
 * de OfferSheet.tsx com 🔔). `type` é texto livre sem CHECK no backend
 * (ver ../../lib/api/notifications.ts), então tipos futuros desconhecidos
 * caem no fallback genérico. */
const TYPE_ICONS: Record<string, string> = {
  aula_lembrete: '📅',
  vaga_waitlist: '🎾',
  pendencia_criada: '📋',
  fatura_gerada: '💰',
  pagamento_confirmado: '✅',
  inscricoes_abertas: '🏆',
  resultado_torneio: '🏅',
  pedido_atualizado: '📦',
  streak: '🔥',
  badge: '🏆',
  alerta_admin: '⚠️',
}

function iconForType(type: string): string {
  return TYPE_ICONS[type] ?? '🔔'
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; notifications: NotificationItem[]; hasMore: boolean }

function markAllReadLocally(notifications: NotificationItem[]): NotificationItem[] {
  const now = new Date().toISOString()
  return notifications.map((n) => (n.readAt ? n : { ...n, readAt: now }))
}

function markOneReadLocally(notifications: NotificationItem[], id: string): NotificationItem[] {
  const now = new Date().toISOString()
  return notifications.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n))
}

/**
 * N1 — Centro de Notificações (BEAC-2021, story BEAC-1723). Mesmo padrão de
 * S1Page.tsx: LoadState discriminado loading/error/ready, useEffect
 * cancelável via `.then`/`.catch` (não async/await no topo — exigido pelo
 * lint react-hooks/set-state-in-effect).
 *
 * Marcar 1/todas como lidas atualiza o estado local em vez de refazer GET
 * /me/notifications — evita um round-trip extra só pra apagar os dots.
 */
export default function N1Page() {
  const { orgLabel, userLabel } = useShellIdentity()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const loadInitial = useCallback((onCancelled: () => boolean) => {
    listNotifications({ limit: PAGE_SIZE, offset: 0 })
      .then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', notifications: result.notifications, hasMore: result.hasMore })
      })
      .catch(() => {
        if (!onCancelled()) setState({ status: 'error' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadInitial(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadInitial])

  function handleRetry() {
    setState({ status: 'loading' })
    loadInitial(() => false)
  }

  async function handleLoadMore() {
    if (state.status !== 'ready') return
    setLoadingMore(true)
    try {
      const result = await listNotifications({ limit: PAGE_SIZE, offset: state.notifications.length })
      if (result.ok) {
        setState((current) =>
          current.status === 'ready'
            ? {
                status: 'ready',
                notifications: [...current.notifications, ...result.notifications],
                hasMore: result.hasMore,
              }
            : current,
        )
      }
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true)
    try {
      const result = await markAllNotificationsRead()
      if (result.ok) {
        setState((current) =>
          current.status === 'ready'
            ? { ...current, notifications: markAllReadLocally(current.notifications) }
            : current,
        )
      }
    } finally {
      setMarkingAllRead(false)
    }
  }

  async function handleTapNotification(notification: NotificationItem) {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, notifications: markOneReadLocally(current.notifications, notification.id) }
        : current,
    )
    try {
      await markNotificationRead(notification.id)
    } catch {
      // best-effort — ver S1Page.tsx (enterMembership), mesmo padrão.
    }

    // resolveNotificationRoute (lib/notificationRouting.ts) é a mesma fonte
    // de verdade usada pelo tap em push nativo (BEAC-2020) — só resolve
    // reference_type cuja rota existente precisa APENAS do próprio id, OU de
    // dados já disponíveis no cliente (vaga_waitlist -> AG9/OfferSheet.tsx,
    // BEAC-1724/BEAC-2023, via getActiveUnitId()). Os demais tipos
    // (booking/tournament_match/pending_approval/pedido/feedback) ficam null
    // de propósito, ver comentário de pacote daquele arquivo — este
    // componente só marca como lida nesses casos, sem navegar.
    const target = resolveNotificationRoute(notification.referenceType, notification.referenceId)
    if (target) navigate(target)
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="n1-header">
        <h1>Notificações</h1>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleMarkAllRead}
          disabled={markingAllRead || state.status !== 'ready' || state.notifications.length === 0}
        >
          Marcar lidas
        </button>
      </div>

      {state.status === 'loading' && (
        <PageLoading label="Carregando notificações" variant="list" />
      )}

      {state.status === 'error' && (
        <div className="n1-error">
          <p>Não foi possível carregar suas notificações agora.</p>
          <button type="button" className="btn btn-secondary btn-md" onClick={handleRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'ready' && state.notifications.length === 0 && (
        <p className="n1-empty">Tudo tranquilo por aqui! 🏖️</p>
      )}

      {state.status === 'ready' && state.notifications.length > 0 && (
        <div className="n1-list">
          {groupNotificationsByRecency(state.notifications).map((group) => (
            <div className="n1-group" key={group.label}>
              <div className="n1-group-label">{group.label}</div>
              {group.items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="n1-row"
                  data-notification={notification.id}
                  onClick={() => handleTapNotification(notification)}
                >
                  <span className="n1-row-icon">{iconForType(notification.type)}</span>
                  <span className="n1-row-body">
                    <span className="n1-row-title">{notification.title}</span>
                    <span className="n1-row-desc">{notification.body}</span>
                    <span className="n1-row-time">{formatRelativeTimestamp(notification.createdAt)}</span>
                  </span>
                  {!notification.readAt && <span className="n1-row-dot" aria-label="não lida" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {state.status === 'ready' && state.hasMore && (
        <div className="n1-load-more-row">
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </AppShell>
  )
}
