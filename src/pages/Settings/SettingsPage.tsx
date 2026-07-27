import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type ChannelPref,
  type NotificationChannel,
} from '../../lib/api/notificationPreferences'
import '../../components/AuthLayout/AuthLayout.css'
import './SettingsPage.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; channels: ChannelPref[] }

function setChannelEnabledLocally(
  channels: ChannelPref[],
  channel: NotificationChannel,
  enabled: boolean,
): ChannelPref[] {
  return channels.map((c) => (c.channel === channel ? { ...c, enabled } : c))
}

/**
 * PF5 — Configurações (BEAC-2035, story BEAC-1727). ESCOPO MÍNIMO,
 * deliberado: só a seção "Notificações" do protótipo real (doc Allye "PF5 —
 * Configurações", a6aa8216-bd89-484f-a376-f705148ff9e0, lido direto antes de
 * implementar). Nenhuma story de nenhum épico anterior confirmou a
 * existência da tela PF5 completa no rallye-app — as outras seções do
 * protótipo (Aparência/tema escuro, Privacidade/visibilidade no ranking,
 * Sobre/Termos/Contato, Excluir conta) NÃO são construídas aqui, é gap
 * cross-epic documentado no relatório de execução (AC explícito da task:
 * "sem construir a tela PF5 inteira, fora de escopo deste épico").
 * Alcançável a partir de ProfilePage.tsx ("Configurações", agora com
 * destino real em vez de MenuRow inerte).
 *
 * WhatsApp é renderizado sempre OFF e disabled, independente do estado
 * salvo no backend — a integração real (WhatsApp Business API) é pós-MVP
 * (doc PF5, regra 4: "só disponível se integrado"), então este toggle não
 * lê nem escreve public.notification_channel_prefs.channel='whatsapp' de
 * verdade ainda, só espelha visualmente o protótipo.
 */
export default function SettingsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [savingChannel, setSavingChannel] = useState<NotificationChannel | null>(null)

  const load = useCallback((onCancelled: () => boolean) => {
    getNotificationPreferences()
      .then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ready', channels: result.channels })
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

  function enabledFor(channel: NotificationChannel): boolean {
    if (state.status !== 'ready') return true
    return state.channels.find((c) => c.channel === channel)?.enabled ?? true
  }

  async function handleToggle(channel: NotificationChannel, enabled: boolean) {
    if (state.status !== 'ready') return
    const previousChannels = state.channels
    setState({ status: 'ready', channels: setChannelEnabledLocally(previousChannels, channel, enabled) })
    setSavingChannel(channel)
    try {
      const result = await patchNotificationPreferences({ channels: [{ channel, enabled }] })
      if (!result.ok) {
        setState((current) =>
          current.status === 'ready' ? { status: 'ready', channels: previousChannels } : current,
        )
      }
    } finally {
      setSavingChannel(null)
    }
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to="/perfil" aria-label="Voltar">
          ‹
        </Link>
        <h1>Configurações</h1>
        <div className="spacer" />
      </div>

      {state.status === 'loading' && <p role="status">Carregando configurações…</p>}

      {state.status === 'error' && (
        <div className="pf5-error">
          <p>Não foi possível carregar suas configurações agora.</p>
          <button type="button" className="btn btn-secondary btn-md" onClick={handleRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="dash-body">
          <div>
            <div className="set-title">Notificações</div>
            <div className="menu-list">
              <div className="menu-row">
                <span>🔔 Push notifications</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={enabledFor('push')}
                    aria-label="Push notifications"
                    disabled={savingChannel === 'push'}
                    onChange={(e) => handleToggle('push', e.target.checked)}
                  />
                  <span className="tr" />
                  <span className="th" />
                </label>
              </div>
              <div className="menu-row">
                <span>📧 Email</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={enabledFor('email')}
                    aria-label="Email"
                    disabled={savingChannel === 'email'}
                    onChange={(e) => handleToggle('email', e.target.checked)}
                  />
                  <span className="tr" />
                  <span className="th" />
                </label>
              </div>
              <div className="menu-row menu-row-whatsapp">
                <span className="menu-row-main">
                  <span>📱 WhatsApp</span>
                  <span className="hint-inline">disponível quando a integração estiver ativa</span>
                </span>
                <label className="switch">
                  <input type="checkbox" checked={false} aria-label="WhatsApp" disabled />
                  <span className="tr" />
                  <span className="th" />
                </label>
              </div>
              <Link className="menu-row" to="/configuracoes/notificacoes">
                <span>Gerenciar preferências por evento</span>
                <span className="chev">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
