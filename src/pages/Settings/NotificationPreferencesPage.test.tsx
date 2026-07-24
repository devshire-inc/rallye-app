import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as notificationPreferencesApi from '../../lib/api/notificationPreferences'
import type { EventPref } from '../../lib/api/notificationPreferences'
import NotificationPreferencesPage from './NotificationPreferencesPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const BASE_EVENTS: EventPref[] = [
  { eventType: 'aula_lembrete', enabled: true },
  { eventType: 'aula_cancelamento', enabled: true },
  { eventType: 'vaga_waitlist', enabled: true },
  { eventType: 'remarcacao_decidida', enabled: true },
  { eventType: 'fatura_gerada', enabled: true },
  { eventType: 'fatura_vencendo', enabled: true },
  { eventType: 'fatura_vencida', enabled: true },
  { eventType: 'pagamento_confirmado', enabled: true },
  { eventType: 'torneio_inscricoes_abertas', enabled: true },
  { eventType: 'torneio_jogo_proximo', enabled: true },
  { eventType: 'torneio_resultado', enabled: true },
  { eventType: 'torneio_ranking_atualizado', enabled: false },
  { eventType: 'loja_pedido_atualizado', enabled: true },
  { eventType: 'loja_promocao', enabled: false },
  { eventType: 'progresso_novo_feedback', enabled: true },
  { eventType: 'progresso_badge_desbloqueado', enabled: true },
]

const ADMIN_EVENTS: EventPref[] = [
  { eventType: 'admin_alerta_inadimplencia', enabled: true },
  { eventType: 'admin_alerta_manutencao', enabled: true },
  { eventType: 'admin_alerta_waitlist_cheia', enabled: true },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/configuracoes/notificacoes']}>
      <Routes>
        <Route path="/configuracoes/notificacoes" element={<NotificationPreferencesPage />} />
        <Route path="/configuracoes" element={<div>Configurações placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationPreferencesPage — loading', () => {
  it('shows a loading status while preferences are pending', () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockReturnValue(
      new Promise(() => {}),
    )

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('NotificationPreferencesPage — network error', () => {
  it('shows a message and a retry button on failure, and retry reloads successfully', async () => {
    const getSpy = vi
      .spyOn(notificationPreferencesApi, 'getNotificationPreferences')
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'internal_error' })
      .mockResolvedValueOnce({ ok: true, channels: [], events: BASE_EVENTS })

    renderPage()

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByText('Lembrete de aula')).toBeInTheDocument()
    expect(getSpy).toHaveBeenCalledTimes(2)
  })
})

describe('NotificationPreferencesPage — grupos e defaults (não-admin)', () => {
  it('renders every group/label from the prototype in order, with defaults ON except Ranking atualizado/Promoções, and hides the admin group', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [],
      events: BASE_EVENTS,
    })

    renderPage()

    const groups = within(await screen.findByTestId('pf6-groups'))
    for (const title of ['Aulas', 'Financeiro', 'Torneios', 'Loja', 'Progresso']) {
      expect(groups.getByText(title)).toBeInTheDocument()
    }
    for (const label of [
      'Lembrete de aula',
      'Cancelamento de aula',
      'Vaga na waitlist',
      'Remarcação aprovada',
      'Fatura gerada',
      'Lembrete vencimento',
      'Lembrete atraso',
      'Pagamento confirmado',
      'Inscrições abertas',
      'Meu jogo próximo',
      'Resultado do torneio',
      'Ranking atualizado',
      'Pedido atualizado',
      'Promoções',
      'Novo feedback',
      'Badge desbloqueado',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }

    expect(screen.getByLabelText('Lembrete de aula')).toBeChecked()
    expect(screen.getByLabelText('Ranking atualizado')).not.toBeChecked()
    expect(screen.getByLabelText('Promoções')).not.toBeChecked()

    expect(screen.queryByText('Alertas de inadimplência')).not.toBeInTheDocument()
    expect(screen.queryByText('Manutenção')).not.toBeInTheDocument()
    expect(screen.queryByText('Waitlist cheia')).not.toBeInTheDocument()
  })
})

describe('NotificationPreferencesPage — admin', () => {
  it('renders the extra admin group when the backend includes admin event_types in the response', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [],
      events: [...BASE_EVENTS, ...ADMIN_EVENTS],
    })

    renderPage()

    expect(await screen.findByText('Alertas de inadimplência')).toBeInTheDocument()
    expect(screen.getByText('Manutenção')).toBeInTheDocument()
    expect(screen.getByText('Waitlist cheia')).toBeInTheDocument()
  })
})

describe('NotificationPreferencesPage — toggle', () => {
  it('optimistically toggles and PATCHes only the changed event_type', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [],
      events: BASE_EVENTS,
    })
    const patchSpy = vi
      .spyOn(notificationPreferencesApi, 'patchNotificationPreferences')
      .mockResolvedValue({
        ok: true,
        channels: [],
        events: [{ eventType: 'vaga_waitlist', enabled: false }],
      })

    renderPage()
    const toggle = await screen.findByLabelText('Vaga na waitlist')
    expect(toggle).toBeChecked()

    await userEvent.click(toggle)

    expect(toggle).not.toBeChecked()
    expect(patchSpy).toHaveBeenCalledWith({ events: [{ eventType: 'vaga_waitlist', enabled: false }] })
  })

  it('reverts the optimistic toggle when the PATCH fails', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [],
      events: BASE_EVENTS,
    })
    vi.spyOn(notificationPreferencesApi, 'patchNotificationPreferences').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    renderPage()
    const toggle = await screen.findByLabelText('Vaga na waitlist')

    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
  })

  it('navigates back to /configuracoes via the back link', async () => {
    vi.spyOn(notificationPreferencesApi, 'getNotificationPreferences').mockResolvedValue({
      ok: true,
      channels: [],
      events: BASE_EVENTS,
    })

    renderPage()
    await screen.findByText('Aulas')

    await userEvent.click(screen.getByRole('link', { name: /voltar/i }))

    expect(await screen.findByText('Configurações placeholder')).toBeInTheDocument()
  })
})
