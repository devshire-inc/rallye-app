import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { PermissionsProvider } from '../context/PermissionsContext'
import { QueryTestProvider } from './queryTestClient'

/**
 * Pages under `AppShell` (BEAC-2058) render it as a child, and AppShell
 * itself calls `usePermission(...)` for its own nav gating — which throws
 * without an ancestor `PermissionsProvider` (BEAC-1841's fail-closed
 * contract). Tests that don't assert on AppShell's own permission-gated nav
 * only need the Provider to exist so the render doesn't crash; its default
 * `idle` state already makes `usePermission` return `false` for everything,
 * same as before AppShell called it. Pages that DO assert on
 * permission-gated behavior of their own (e.g. ArenaSettingsPage,
 * DayUseBookingsPage) mock `fetchMePermissions` and dispatch
 * `SESSION_ESTABLISHED_EVENT` directly instead — this helper is for
 * everyone else.
 *
 * O `QueryClientProvider` por fora passou a ser obrigatório desde que os
 * dados globais de identidade (`/me`, `/me/memberships`, `/me/permissions`)
 * viraram queries do TanStack Query: tanto o `PermissionsProvider` quanto o
 * `useShellIdentity`/`useMe` das páginas leem do cache, e sem um client em
 * contexto o render lança "No QueryClient set".
 */
export function renderWithPermissions(ui: ReactElement): RenderResult {
  return render(
    <QueryTestProvider>
      <PermissionsProvider>{ui}</PermissionsProvider>
    </QueryTestProvider>,
  )
}
