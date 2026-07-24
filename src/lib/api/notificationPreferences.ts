// Cliente HTTP de GET/PATCH /me/notification-preferences (BEAC-2032, story
// BEAC-1727) — rallye-api/api/internal/notifications/preferences_handler.go.
// Mesmo padrão de ./notifications.ts/./unitSettings.ts: usa apiFetch (não
// fetch cru), ApiFailure/failureFrom locais, tipos wire (snake_case)
// convertidos pra camelCase na borda.
import { apiFetch } from '../httpClient'

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error', message: body.message }
}

/** Mesmo enum fechado do CHECK de notification_channel_prefs.channel
 * (migrations/000070) — ao contrário de EventPref.eventType, canal é um
 * conjunto fixo definido pela infra de envio, não por domínios de negócio. */
export type NotificationChannel = 'push' | 'email' | 'whatsapp'

export interface ChannelPref {
  channel: NotificationChannel
  enabled: boolean
}

/** `eventType` é texto livre sem CHECK no backend (mesmo espírito de
 * notifications.type, ver ./notifications.ts) — o backend só devolve, no
 * catálogo hoje conhecido, as chaves que existem; grupos admin-only (ver
 * PF6) só aparecem pra quem tem config:read, então a ausência de uma chave
 * na resposta já é o sinal de "não mostrar esse toggle", sem precisar de
 * checagem extra de permissão no cliente. */
export interface EventPref {
  eventType: string
  enabled: boolean
}

type ChannelPrefWire = { channel: NotificationChannel; enabled: boolean }
type EventPrefWire = { event_type: string; enabled: boolean }
type NotificationPreferencesWire = { channels: ChannelPrefWire[]; events: EventPrefWire[] }

export interface NotificationPreferences {
  channels: ChannelPref[]
  events: EventPref[]
}

function fromWire(wire: NotificationPreferencesWire): NotificationPreferences {
  return {
    channels: wire.channels.map((c) => ({ channel: c.channel, enabled: c.enabled })),
    events: wire.events.map((e) => ({ eventType: e.event_type, enabled: e.enabled })),
  }
}

export type GetNotificationPreferencesResult = ({ ok: true } & NotificationPreferences) | ApiFailure

/** GET /me/notification-preferences — estado atual de canais (PF5) e
 * eventos (PF6), com defaults já resolvidos pelo backend pra qualquer
 * combinação ainda não gravada (ver preferences_handler.go). */
export async function getNotificationPreferences(): Promise<GetNotificationPreferencesResult> {
  const response = await apiFetch('/me/notification-preferences')
  if (!response.ok) return failureFrom(response)

  const wire = (await response.json()) as NotificationPreferencesWire
  return { ok: true, ...fromWire(wire) }
}

export interface PatchNotificationPreferencesInput {
  channels?: Array<{ channel: NotificationChannel; enabled: boolean }>
  events?: Array<{ eventType: string; enabled: boolean }>
}

export type PatchNotificationPreferencesResult = ({ ok: true } & NotificationPreferences) | ApiFailure

/** PATCH /me/notification-preferences — upsert parcial: só os canais/eventos
 * enviados são alterados, o resto permanece como estava (default ou
 * override anterior). Resposta é o estado completo pós-update, mesmo shape
 * do GET. */
export async function patchNotificationPreferences(
  input: PatchNotificationPreferencesInput,
): Promise<PatchNotificationPreferencesResult> {
  const body: { channels?: ChannelPrefWire[]; events?: EventPrefWire[] } = {}
  if (input.channels) {
    body.channels = input.channels.map((c) => ({ channel: c.channel, enabled: c.enabled }))
  }
  if (input.events) {
    body.events = input.events.map((e) => ({ event_type: e.eventType, enabled: e.enabled }))
  }

  const response = await apiFetch('/me/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!response.ok) return failureFrom(response)

  const wire = (await response.json()) as NotificationPreferencesWire
  return { ok: true, ...fromWire(wire) }
}
