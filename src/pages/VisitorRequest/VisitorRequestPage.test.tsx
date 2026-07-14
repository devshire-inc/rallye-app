import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import { getPendingVisitorRequest, clearPendingVisitorRequest } from '../../lib/pendingVisitorRequest'
import { VisitorRequestPage } from './VisitorRequestPage'

const TOURNAMENT_ID = 'tournament-1'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/tournaments/${TOURNAMENT_ID}/visitor`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/visitor" element={<VisitorRequestPage />} />
        <Route path="/tournaments/:tournamentId/visitor/verify" element={<div>Etapa 2 stub</div>} />
        <Route path="/tournaments/:tournamentId" element={<div>Visão do torneio stub</div>} />
        <Route path="/login" element={<div>Login stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitEmail(email: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /enviar código/i }))
}

afterEach(() => {
  clearPendingVisitorRequest()
  vi.restoreAllMocks()
})

describe('VisitorRequestPage', () => {
  it('on a new email, requests the code and navigates to etapa 2', async () => {
    const spy = vi
      .spyOn(api, 'requestVisitorCode')
      .mockResolvedValue({ accountExists: false, sent: true })
    renderPage()

    await submitEmail('visitante@example.com')

    await waitFor(() => expect(spy).toHaveBeenCalledWith('visitante@example.com', TOURNAMENT_ID))
    await waitFor(() => expect(screen.getByText('Etapa 2 stub')).toBeInTheDocument())
    expect(getPendingVisitorRequest()).toEqual({ email: 'visitante@example.com', tournamentId: TOURNAMENT_ID })
  })

  it('on an email that already has a full account, suggests login instead of proceeding', async () => {
    vi.spyOn(api, 'requestVisitorCode').mockResolvedValue({ accountExists: true, sent: false })
    renderPage()

    await submitEmail('jafiliado@example.com')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Você já tem conta!'),
    )
    fireEvent.click(screen.getByRole('button', { name: /fazer login/i }))
    await waitFor(() => expect(screen.getByText('Login stub')).toBeInTheDocument())
  })

  it('offers "Apenas visualizar" navigating straight to the public tournament view', async () => {
    const spy = vi.spyOn(api, 'requestVisitorCode')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /apenas visualizar/i }))

    await waitFor(() => expect(screen.getByText('Visão do torneio stub')).toBeInTheDocument())
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows an error when the resend rate limit is hit', async () => {
    vi.spyOn(api, 'requestVisitorCode').mockRejectedValue(new api.VisitorRequestError('too_many_resends'))
    renderPage()

    await submitEmail('visitante@example.com')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Muitos pedidos/))
  })
})
