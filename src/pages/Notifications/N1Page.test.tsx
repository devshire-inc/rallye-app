import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as notificationsApi from '../../lib/api/notifications'
import type { NotificationItem } from '../../lib/api/notifications'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import N1Page from './N1Page'

afterEach(() => {
  vi.restoreAllMocks()
})

/** ISO local, âncora ao meio-dia pra não cruzar meia-noite por causa de
 * timezone — só a diferença de DIAS entre `createdAt` e "agora" importa pro
 * agrupamento (ver src/lib/groupNotifications.ts), não a hora exata. */
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notif-1',
    type: 'aula_lembrete',
    title: 'Aula em 1h',
    body: 'Sua aula de Beach Tennis começa às 18h',
    referenceType: null,
    referenceId: null,
    readAt: null,
    createdAt: isoDaysAgo(0),
    ...overrides,
  }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/notificacoes']}>
      <Routes>
        <Route path="/notificacoes" element={<N1Page />} />
        <Route path="/invoices/:invoiceId" element={<div>Invoice placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('N1Page — loading', () => {
  it('shows a skeleton while notifications are loading', () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockReturnValue(new Promise(() => {}))

    renderPage()

    // <PageLoading variant="list"> anuncia via a região aria-live do
    // SkeletonGroup, cujo texto é o conteúdo (role="status" não aceita
    // nome-por-conteúdo, então o antigo `name:` do getByRole não se aplica).
    expect(screen.getByRole('status')).toHaveTextContent(/carregando notificações/i)
  })
})

describe('N1Page — network error', () => {
  it('shows a message and a retry button on failure, and retry reloads successfully', async () => {
    const listSpy = vi
      .spyOn(notificationsApi, 'listNotifications')
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'notifications_list_failed' })
      .mockResolvedValueOnce({ ok: true, notifications: [notification()], hasMore: false })
    const user = userEvent.setup()

    renderPage()

    expect(
      await screen.findByText(/não foi possível carregar suas notificações/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(await screen.findByText('Aula em 1h')).toBeInTheDocument()
    expect(listSpy).toHaveBeenCalledTimes(2)
  })
})

describe('N1Page — empty state', () => {
  it('shows the empty state copy and no rows', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [],
      hasMore: false,
    })

    renderPage()

    expect(await screen.findByText('Tudo tranquilo por aqui! 🏖️')).toBeInTheDocument()
    expect(document.querySelector('[data-notification]')).not.toBeInTheDocument()
  })
})

describe('N1Page — grouped list', () => {
  it('groups notifications under Hoje/Ontem/Esta semana/Mais antigas, in order, each with title/desc/time/icon/dot', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [
        notification({ id: 'today-1', title: 'Hoje 1', createdAt: isoDaysAgo(0), readAt: null }),
        notification({
          id: 'yesterday-1',
          title: 'Ontem 1',
          type: 'fatura_gerada',
          createdAt: isoDaysAgo(1),
          readAt: isoDaysAgo(1),
        }),
        notification({
          id: 'week-1',
          title: 'Semana 1',
          type: 'badge',
          createdAt: isoDaysAgo(3),
        }),
        notification({
          id: 'old-1',
          title: 'Antiga 1',
          type: 'unknown_type_xyz',
          createdAt: isoDaysAgo(40),
        }),
      ],
      hasMore: false,
    })

    renderPage()

    await screen.findByText('Hoje 1')

    const groupLabels = Array.from(document.querySelectorAll('.n1-group-label')).map((el) => el.textContent)
    expect(groupLabels).toEqual(['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'])

    const todayRow = screen.getByText('Hoje 1').closest('[data-notification]') as HTMLElement
    expect(within(todayRow).getByText('Sua aula de Beach Tennis começa às 18h')).toBeInTheDocument()
    expect(within(todayRow).getByText('📅')).toBeInTheDocument()
    expect(todayRow.querySelector('.n1-row-dot')).toBeInTheDocument()

    const yesterdayRow = screen.getByText('Ontem 1').closest('[data-notification]') as HTMLElement
    expect(within(yesterdayRow).getByText('💰')).toBeInTheDocument()
    expect(yesterdayRow.querySelector('.n1-row-dot')).not.toBeInTheDocument()

    const oldRow = screen.getByText('Antiga 1').closest('[data-notification]') as HTMLElement
    expect(within(oldRow).getByText('🔔')).toBeInTheDocument()
  })
})

describe('N1Page — Marcar lidas', () => {
  it('calls mark-all-read and clears the unread dots locally, without refetching the list', async () => {
    const listSpy = vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [notification({ id: 'a', readAt: null }), notification({ id: 'b', readAt: null })],
      hasMore: false,
    })
    const markAllSpy = vi.spyOn(notificationsApi, 'markAllNotificationsRead').mockResolvedValue({
      ok: true,
      marked: 2,
    })
    const user = userEvent.setup()

    renderPage()
    await screen.findAllByText('Aula em 1h')
    expect(document.querySelectorAll('.n1-row-dot')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /marcar lidas/i }))

    expect(markAllSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelectorAll('.n1-row-dot')).toHaveLength(0))
    expect(listSpy).toHaveBeenCalledTimes(1)
  })
})

describe('N1Page — tap a notification', () => {
  it('marks it as read and navigates when reference_type resolves to a real route (invoice -> F3)', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [
        notification({
          id: 'inv-notif',
          title: 'Fatura gerada',
          type: 'fatura_gerada',
          referenceType: 'invoice',
          referenceId: 'inv-42',
        }),
      ],
      hasMore: false,
    })
    const markReadSpy = vi.spyOn(notificationsApi, 'markNotificationRead').mockResolvedValue({ ok: true })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByText('Fatura gerada'))

    expect(markReadSpy).toHaveBeenCalledWith('inv-notif')
    expect(await screen.findByText('Invoice placeholder')).toBeInTheDocument()
  })

  it('marks it as read but does not navigate when there is no resolvable route yet (booking -> AG5 gap)', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [
        notification({
          id: 'booking-notif',
          title: 'Aula em 1h',
          type: 'aula_lembrete',
          referenceType: 'booking',
          referenceId: 'book-1',
        }),
      ],
      hasMore: false,
    })
    const markReadSpy = vi.spyOn(notificationsApi, 'markNotificationRead').mockResolvedValue({ ok: true })
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByText('Aula em 1h'))

    expect(markReadSpy).toHaveBeenCalledWith('booking-notif')
    expect(screen.queryByText('Invoice placeholder')).not.toBeInTheDocument()
    expect(await screen.findByText('Aula em 1h')).toBeInTheDocument()
  })
})

describe('N1Page — pagination', () => {
  it('shows "Carregar mais" when has_more is true, fetching the next offset and appending on click', async () => {
    const listSpy = vi
      .spyOn(notificationsApi, 'listNotifications')
      .mockResolvedValueOnce({ ok: true, notifications: [notification({ id: 'a', title: 'Item A' })], hasMore: true })
      .mockResolvedValueOnce({ ok: true, notifications: [notification({ id: 'b', title: 'Item B' })], hasMore: false })
    const user = userEvent.setup()

    renderPage()
    await screen.findByText('Item A')

    await user.click(screen.getByRole('button', { name: /carregar mais/i }))

    expect(await screen.findByText('Item B')).toBeInTheDocument()
    expect(listSpy).toHaveBeenLastCalledWith({ limit: 20, offset: 1 })
    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument()
  })

  it('does not show "Carregar mais" when has_more is false', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({
      ok: true,
      notifications: [notification()],
      hasMore: false,
    })

    renderPage()
    await screen.findByText('Aula em 1h')

    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument()
  })
})
