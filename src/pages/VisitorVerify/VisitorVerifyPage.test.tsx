import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { setPendingVisitorRequest, clearPendingVisitorRequest } from '../../lib/pendingVisitorRequest'
import { clearVisitorSession, getVisitorSession } from '../../lib/visitorSession'
import { VisitorVerifyPage } from './VisitorVerifyPage'

const TOURNAMENT_ID = 'tournament-1'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/tournaments/${TOURNAMENT_ID}/visitor/verify`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/visitor/verify" element={<VisitorVerifyPage />} />
        <Route path="/tournaments/:tournamentId" element={<div>Visão do torneio stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillOtp(code: string) {
  const inputs = screen.getAllByRole('textbox')
  code.split('').forEach((digit, i) => {
    fireEvent.change(inputs[i], { target: { value: digit } })
  })
}

beforeEach(() => {
  setPendingVisitorRequest({ email: 'visitante@example.com', tournamentId: TOURNAMENT_ID })
})

afterEach(() => {
  clearPendingVisitorRequest()
  clearVisitorSession()
  vi.restoreAllMocks()
})

describe('VisitorVerifyPage', () => {
  it('shows the email the code was sent to', () => {
    renderPage()
    expect(screen.getByText(/visitante@example.com/)).toBeInTheDocument()
  })

  it('on a valid code, activates the temporary session and navigates to the tournament view with notifications enabled', async () => {
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    vi.spyOn(api, 'verifyVisitorCode').mockResolvedValue({
      type: 'temporary',
      scope: `tournament:${TOURNAMENT_ID}`,
      expiresAt,
    })
    renderPage()

    fillOtp('123456')

    await waitFor(() => expect(screen.getByText('Visão do torneio stub')).toBeInTheDocument())
    expect(getVisitorSession()).toEqual({
      email: 'visitante@example.com',
      tournamentId: TOURNAMENT_ID,
      scope: `tournament:${TOURNAMENT_ID}`,
      expiresAt,
    })
  })

  it('on an invalid code, shows an error and clears the fields', async () => {
    vi.spyOn(api, 'verifyVisitorCode').mockRejectedValue(new api.VisitorVerifyError('invalid_code'))
    renderPage()

    fillOtp('000000')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código incorreto'))
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs.every((i) => i.value === '')).toBe(true)
  })
})
