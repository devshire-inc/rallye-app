import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as notificationPreferencesApi from '../../lib/api/notificationPreferences'
import type { ChannelPref } from '../../lib/api/notificationPreferences'
import SettingsPage from './SettingsPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const DEFAULT_CHANNELS: ChannelPref[] = [
  { channel: 'push', enabled: true },
  { channel: 'email', enabled: true },
  { channel: 'whatsapp', enabled: false },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/configuracoes']}>
      <Routes>
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/configuracoes/notificacoes" element={<div>PF6 placeholder</div>} />
        <Route path="/perfil" element={<div>Perfil placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SettingsPage — loading', () => {
  it('shows a loading status while preferences are pending', () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockReturnValue(
      new Promise(() => {}),
    )

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('SettingsPage — network error', () => {
  it('shows a message and a retry button on failure, and retry reloads successfully', async () => {
    const getSpy = vi
      .spyOn(notificationPreferencesApi, 'getNotificationPreferences')
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'internal_error' })
      .mockResolvedValueOnce({ ok: true, channels: DEFAULT_CHANNELS, events: [] })

    renderPage()

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByLabelText('Push notifications')).toBeInTheDocument()
    expect(getSpy).toHaveBeenCalledTimes(2)
  })
})

describe('SettingsPage — defaults (protótipo scr-pf5)', () => {
  it('renders Push/Email ON and WhatsApp OFF+disabled with the hint, plus the link to PF6', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: DEFAULT_CHANNELS,
      events: [],
    })

    renderPage()

    const push = await screen.findByLabelText('Push notifications')
    const email = screen.getByLabelText('Email')
    const whatsapp = screen.getByLabelText('WhatsApp')

    expect(push).toBeChecked()
    expect(push).not.toBeDisabled()
    expect(email).toBeChecked()
    expect(email).not.toBeDisabled()
    expect(whatsapp).not.toBeChecked()
    expect(whatsapp).toBeDisabled()
    expect(screen.getByText('disponível quando a integração estiver ativa')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /gerenciar preferências por evento/i })).toHaveAttribute(
      'href',
      '/configuracoes/notificacoes',
    )
  })

  it('ignores any backend-saved state for whatsapp — always OFF and disabled regardless', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [
        { channel: 'push', enabled: true },
        { channel: 'email', enabled: true },
        { channel: 'whatsapp', enabled: true },
      ],
      events: [],
    })

    renderPage()

    const whatsapp = await screen.findByLabelText('WhatsApp')
    expect(whatsapp).not.toBeChecked()
    expect(whatsapp).toBeDisabled()
  })
})

describe('SettingsPage — toggle', () => {
  it('optimistically toggles Push and PATCHes only that channel', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: DEFAULT_CHANNELS,
      events: [],
    })
    const patchSpy = vi
      .spyOn(notificationPreferencesApi, 'patchNotificationPreferences')
      .mockResolvedValue({ ok: true, channels: [{ channel: 'push', enabled: false }], events: [] })

    renderPage()
    const push = await screen.findByLabelText('Push notifications')
    expect(push).toBeChecked()

    await userEvent.click(push)

    expect(push).not.toBeChecked()
    expect(patchSpy).toHaveBeenCalledWith({ channels: [{ channel: 'push', enabled: false }] })
  })

  it('reverts the optimistic toggle when the PATCH fails', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: DEFAULT_CHANNELS,
      events: [],
    })
    vi.spyOn(notificationPreferencesApi, 'patchNotificationPreferences').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()
    const email = await screen.findByLabelText('Email')

    await userEvent.click(email)

    expect(await screen.findByLabelText('Email')).toBeChecked()
  })
})

describe('SettingsPage — navigation', () => {
  it('the "Gerenciar preferências por evento" link navigates to PF6', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: DEFAULT_CHANNELS,
      events: [],
    })

    renderPage()
    await screen.findByLabelText('Push notifications')

    await userEvent.click(screen.getByRole('link', { name: /gerenciar preferências por evento/i }))

    expect(await screen.findByText('PF6 placeholder')).toBeInTheDocument()
  })

  it('the back link navigates to /perfil', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: DEFAULT_CHANNELS,
      events: [],
    })

    renderPage()
    await screen.findByLabelText('Push notifications')

    await userEvent.click(screen.getByRole('link', { name: /voltar/i }))

    expect(await screen.findByText('Perfil placeholder')).toBeInTheDocument()
  })
})
