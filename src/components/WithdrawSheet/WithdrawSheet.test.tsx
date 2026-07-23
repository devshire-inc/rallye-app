import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as tournamentWithdrawalApi from '../../lib/api/tournamentWithdrawal'
import { formatBRL } from '../../lib/money'
import { WithdrawSheet } from './WithdrawSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderSheet(onWithdrawn = vi.fn(), onClose = vi.fn()) {
  render(
    <WithdrawSheet
      open
      onClose={onClose}
      registrationId="reg-1"
      pairLabel="Marina Costa / Carla Trindade"
      categoryName="Feminina B"
      totalAmount={80}
      onWithdrawn={onWithdrawn}
    />,
  )
  return { onWithdrawn, onClose }
}

describe('WithdrawSheet — conteúdo', () => {
  it('shows the subtitle with dupla + categoria, the rule toast, and the foot-note (cópia exata)', () => {
    renderSheet()

    expect(screen.getByRole('heading', { name: 'Jogador desistiu' })).toBeInTheDocument()
    expect(screen.getByText('Marina Costa / Carla Trindade · Feminina B')).toBeInTheDocument()
    expect(
      screen.getByText('Decisão caso a caso — mesma lógica de estorno do Financeiro (total ou parcial).'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Libera a vaga na categoria imediatamente após confirmar.'),
    ).toBeInTheDocument()
  })

  it('shows the 3 refund-type tabs, Total pré-selecionado com o valor da inscrição', () => {
    renderSheet()

    expect(screen.getByRole('button', { name: `Total — ${formatBRL(80)}` })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Parcial' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sem estorno' })).toBeInTheDocument()
  })
})

describe('WithdrawSheet — os 3 ramos de desistência', () => {
  it('refund_type=total: confirma sem exigir valor', async () => {
    const withdrawSpy = vi
      .spyOn(tournamentWithdrawalApi, 'withdrawRegistration')
      .mockResolvedValue({ ok: true, status: 'withdrawn' })
    const { onWithdrawn } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))

    expect(withdrawSpy).toHaveBeenCalledWith('reg-1', 'total', undefined)
    expect(await screen.findByText(/desistência registrada/i)).toBeInTheDocument()
    await waitFor(
      () => expect(onWithdrawn).toHaveBeenCalledWith({ registrationId: 'reg-1', refundType: 'total' }),
      { timeout: 2000 },
    )
  })

  it('shows the success toast and keeps the sheet open for a moment before closing (BEAC-1994, achado do reviewer)', async () => {
    vi.spyOn(tournamentWithdrawalApi, 'withdrawRegistration').mockResolvedValue({
      ok: true,
      status: 'withdrawn',
    })
    const { onWithdrawn } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))

    // O toast de sucesso precisa aparecer E o sheet precisa continuar aberto
    // logo em seguida — onWithdrawn (que o pai usa pra fechar o sheet) não
    // pode ter disparado ainda nesse instante, senão o usuário nunca chega a
    // ver a confirmação (React 19 batching fechava o sheet no mesmo tick).
    expect(await screen.findByText('Desistência registrada. Vaga liberada na categoria.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Jogador desistiu' })).toBeInTheDocument()
    expect(onWithdrawn).not.toHaveBeenCalled()

    await waitFor(() => expect(onWithdrawn).toHaveBeenCalled(), { timeout: 2000 })
  })

  it('refund_type=parcial: exige um valor > 0 antes de habilitar a confirmação', async () => {
    const withdrawSpy = vi
      .spyOn(tournamentWithdrawalApi, 'withdrawRegistration')
      .mockResolvedValue({ ok: true, status: 'withdrawn' })
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Parcial' }))
    expect(screen.getByRole('button', { name: 'Confirmar desistência' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Valor a estornar'), '40')
    expect(screen.getByRole('button', { name: 'Confirmar desistência' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))

    expect(withdrawSpy).toHaveBeenCalledWith('reg-1', 'parcial', 40)
  })

  it('refund_type=nenhum: confirma sem valor nenhum', async () => {
    const withdrawSpy = vi
      .spyOn(tournamentWithdrawalApi, 'withdrawRegistration')
      .mockResolvedValue({ ok: true, status: 'withdrawn' })
    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Sem estorno' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))

    expect(withdrawSpy).toHaveBeenCalledWith('reg-1', 'nenhum', undefined)
  })

  it('shows an error and does not close the sheet when the backend rejects the withdrawal', async () => {
    vi.spyOn(tournamentWithdrawalApi, 'withdrawRegistration').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'refund_window_expired',
      message: 'Janela de 7 dias expirada',
    })
    const { onClose, onWithdrawn } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar desistência' }))

    expect(await screen.findByText('Janela de 7 dias expirada')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onWithdrawn).not.toHaveBeenCalled()
  })
})
