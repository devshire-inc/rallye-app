import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type EventPref,
} from '../../lib/api/notificationPreferences'
import '../../components/AuthLayout/AuthLayout.css'
import './NotificationPreferencesPage.css'

interface EventCatalogEntry {
  eventType: string
  label: string
}

interface EventGroup {
  title: string
  items: EventCatalogEntry[]
}

/**
 * Catálogo de grupos/rótulos — cópia exata do doc PF6 ("Preferências de
 * Notificação", Allye doc a1734e5c-b072-47df-a5fb-396b35541e41, lido direto
 * antes de implementar): ordem dos grupos, ordem dos itens dentro de cada
 * grupo e o texto de cada rótulo espelham o layout ASCII do protótipo
 * exatamente. Os `eventType` (chaves, não visíveis no protótipo) espelham 1:1
 * o catálogo do backend (notifications.eventCatalog,
 * rallye-api/api/internal/notifications/preferences_handler.go) — qualquer
 * chave aqui SEMPRE existe na resposta de GET /me/notification-preferences
 * pra usuário não-admin (backend só omite os 3 do ADMIN_EVENT_GROUP).
 */
const EVENT_GROUPS: EventGroup[] = [
  {
    title: 'Aulas',
    items: [
      { eventType: 'aula_lembrete', label: 'Lembrete de aula' },
      { eventType: 'aula_cancelamento', label: 'Cancelamento de aula' },
      { eventType: 'vaga_waitlist', label: 'Vaga na waitlist' },
      { eventType: 'remarcacao_decidida', label: 'Remarcação aprovada' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { eventType: 'fatura_gerada', label: 'Fatura gerada' },
      { eventType: 'fatura_vencendo', label: 'Lembrete vencimento' },
      { eventType: 'fatura_vencida', label: 'Lembrete atraso' },
      { eventType: 'pagamento_confirmado', label: 'Pagamento confirmado' },
    ],
  },
  {
    title: 'Torneios',
    items: [
      { eventType: 'torneio_inscricoes_abertas', label: 'Inscrições abertas' },
      { eventType: 'torneio_jogo_proximo', label: 'Meu jogo próximo' },
      { eventType: 'torneio_resultado', label: 'Resultado do torneio' },
      { eventType: 'torneio_ranking_atualizado', label: 'Ranking atualizado' },
    ],
  },
  {
    title: 'Loja',
    items: [
      { eventType: 'loja_pedido_atualizado', label: 'Pedido atualizado' },
      { eventType: 'loja_promocao', label: 'Promoções' },
    ],
  },
  {
    title: 'Progresso',
    items: [
      { eventType: 'progresso_novo_feedback', label: 'Novo feedback' },
      { eventType: 'progresso_badge_desbloqueado', label: 'Badge desbloqueado' },
    ],
  },
]

/**
 * Grupo extra visível só para Admin (doc PF6, regra 4: "Admin vê toggles
 * extras: alertas de inadimplência, manutenção, waitlist cheia"). O backend
 * (BEAC-2032) já omite por completo estes 3 event_types da resposta pra
 * quem não tem `config:read` — a presença/ausência na resposta já é o sinal
 * de permissão, então este componente não chama usePermission de novo:
 * renderiza o grupo só se `hasEvent` encontrar a 1ª chave (as 3 sempre
 * chegam juntas, governadas pelo mesmo isAdmin no backend).
 */
const ADMIN_EVENT_GROUP: EventGroup = {
  title: 'Admin',
  items: [
    { eventType: 'admin_alerta_inadimplencia', label: 'Alertas de inadimplência' },
    { eventType: 'admin_alerta_manutencao', label: 'Manutenção' },
    { eventType: 'admin_alerta_waitlist_cheia', label: 'Waitlist cheia' },
  ],
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: EventPref[] }

function setEnabledLocally(events: EventPref[], eventType: string, enabled: boolean): EventPref[] {
  return events.map((e) => (e.eventType === eventType ? { ...e, enabled } : e))
}

/**
 * PF6 — Preferências de Notificação (BEAC-2034, story BEAC-1727). Protótipo
 * real lido diretamente antes de implementar (doc Allye "PF6 — Preferências
 * de Notificação", não parafraseado de memória) — cada linha é 1 toggle de
 * push notification pra aquele evento (regra 1 do doc); persistência via
 * PATCH /me/notification-preferences (BEAC-2032), 1 evento por vez, com
 * update otimista revertido em falha.
 */
export default function NotificationPreferencesPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [savingType, setSavingType] = useState<string | null>(null)

  const load = useCallback((onCancelled: () => boolean) => {
    getNotificationPreferences()
      .then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', events: result.events })
      })
      .catch(() => {
        if (!onCancelled()) setState({ status: 'error' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  function handleRetry() {
    setState({ status: 'loading' })
    load(() => false)
  }

  function enabledFor(eventType: string): boolean {
    if (state.status !== 'ready') return true
    return state.events.find((e) => e.eventType === eventType)?.enabled ?? true
  }

  function hasEvent(eventType: string): boolean {
    return state.status === 'ready' && state.events.some((e) => e.eventType === eventType)
  }

  async function handleToggle(eventType: string, enabled: boolean) {
    if (state.status !== 'ready') return
    const previousEvents = state.events
    setState({ status: 'ready', events: setEnabledLocally(previousEvents, eventType, enabled) })
    setSavingType(eventType)
    try {
      const result = await patchNotificationPreferences({ events: [{ eventType, enabled }] })
      if (!result.ok) {
        setState((current) =>
          current.status === 'ready' ? { status: 'ready', events: previousEvents } : current,
        )
      }
    } finally {
      setSavingType(null)
    }
  }

  function renderGroup(group: EventGroup) {
    return (
      <div key={group.title}>
        <div className="set-title">{group.title}</div>
        <div className="menu-list">
          {group.items.map((item) => (
            <div className="menu-row" key={item.eventType}>
              <span>{item.label}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={enabledFor(item.eventType)}
                  aria-label={item.label}
                  disabled={savingType === item.eventType}
                  onChange={(e) => handleToggle(item.eventType, e.target.checked)}
                />
                <span className="tr" />
                <span className="th" />
              </label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Notificações">
      <div className="pg-head">
        <Link className="back" to="/configuracoes" aria-label="Voltar">
          ‹
        </Link>
        <h1>Notificações</h1>
        <div className="spacer" />
      </div>

      {state.status === 'loading' && <p role="status">Carregando preferências…</p>}

      {state.status === 'error' && (
        <div className="pf6-error">
          <p>Não foi possível carregar suas preferências agora.</p>
          <button type="button" className="btn btn-secondary btn-md" onClick={handleRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="dash-body" data-testid="pf6-groups">
          {EVENT_GROUPS.map(renderGroup)}
          {hasEvent(ADMIN_EVENT_GROUP.items[0].eventType) && renderGroup(ADMIN_EVENT_GROUP)}
        </div>
      )}
    </AppShell>
  )
}
