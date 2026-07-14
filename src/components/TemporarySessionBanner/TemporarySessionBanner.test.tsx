import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { clearVisitorSession, setVisitorSession } from '../../lib/visitorSession'
import { TemporarySessionBanner } from './TemporarySessionBanner'

function renderBanner(bannerTournamentId?: string) {
  return render(
    <MemoryRouter initialEntries={['/tournaments/tournament-1']}>
      <Routes>
        <Route
          path="/tournaments/:tournamentId"
          element={<TemporarySessionBanner tournamentId={bannerTournamentId} />}
        />
        <Route path="/signup" element={<div>Signup stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  clearVisitorSession()
})

describe('TemporarySessionBanner', () => {
  it('renders nothing when there is no active temporary session', () => {
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the persistent conversion banner during an active temporary session', () => {
    setVisitorSession({
      email: 'visitante@example.com',
      tournamentId: 'tournament-1',
      scope: 'tournament:tournament-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    renderBanner('tournament-1')
    expect(screen.getByText('Acesso temporário')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar conta completa/i })).toBeInTheDocument()
  })

  it('does not show the banner when viewing a different tournament than the one the session is scoped to', () => {
    setVisitorSession({
      email: 'visitante@example.com',
      tournamentId: 'tournament-1',
      scope: 'tournament:tournament-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const { container } = renderBanner('tournament-2')
    expect(container).toBeEmptyDOMElement()
  })

  it('tapping the banner navigates to signup preserving the visitor email', () => {
    setVisitorSession({
      email: 'visitante@example.com',
      tournamentId: 'tournament-1',
      scope: 'tournament:tournament-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /criar conta completa/i }))

    expect(screen.getByText('Signup stub')).toBeInTheDocument()
  })

  it('does not render once the temporary session has expired', () => {
    setVisitorSession({
      email: 'visitante@example.com',
      tournamentId: 'tournament-1',
      scope: 'tournament:tournament-1',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })
})
