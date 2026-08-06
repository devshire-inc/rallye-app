import { useState } from 'react'
import { BottomSheet } from '../BottomSheet/BottomSheet'
import {
  withdrawRegistration,
  type WithdrawRefundType,
} from '../../lib/api/tournamentWithdrawal'
import { formatBRL } from '../../lib/money'
import './WithdrawSheet.css'

/** Mesmo valor do `setTimeout(closeSheet, 1400)` do protótipo real
 * (`#sheet-desistencia`): tempo que o toast de sucesso fica visível antes do
 * sheet fechar. Achado do reviewer (correção nº1, BEAC-1994): chamar
 * `onWithdrawn` no mesmo tick de `setSuccess(true)` fazia o React 19 batchar
 * as duas atualizações — o pai fecha o sheet (`open=false`) no MESMO render
 * em que o toast apareceria pela primeira vez, então o usuário nunca chegava
 * a vê-lo. Adiando `onWithdrawn` (não o `setSuccess`) garante que o toast
 * renderiza e fica visível por este tempo antes do sheet fechar. */
const WITHDRAWN_CONFIRMATION_DELAY_MS = 1400

export interface WithdrawSheetProps {
  open: boolean
  onClose: () => void
  /** Id de public.tournament_registrations — não da categoria/torneio. */
  registrationId: string
  /** "Marina Costa / Carla Trindade" — já resolvido pelo chamador. */
  pairLabel: string
  categoryName: string
  /** Valor da inscrição — usado no rótulo "Total — R$ X" e como o valor de
   * estorno quando refundType='total'. */
  totalAmount: number
  onWithdrawn: (result: { registrationId: string; refundType: WithdrawRefundType }) => void
}

/**
 * Sheet de desistência (BEAC-1994, story BEAC-1718): reusa o BottomSheet
 * genérico (BEAC-1808) — não um dialog próprio. Cópia (toast/foot-note) e
 * tabs Total/Parcial/Sem estorno travadas pelo protótipo real
 * (`#sheet-desistencia`). O campo de valor em "Parcial" não aparece no
 * protótipo estático (sem interatividade lá), mas é exigido pelo backend
 * (POST /tournament-registrations/{id}/withdraw, 400 se refund_type=parcial
 * sem amount>0) — mesma UI já usada por F3InvoiceDetailPage para o mesmo
 * caso em Estornar fatura, que este endpoint reaproveita por baixo (ver
 * withdraw.go).
 */
export function WithdrawSheet({
  open,
  onClose,
  registrationId,
  pairLabel,
  categoryName,
  totalAmount,
  onWithdrawn,
}: WithdrawSheetProps) {
  const [refundType, setRefundType] = useState<WithdrawRefundType>('total')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Reseta os campos toda vez que o sheet TRANSICIONA de fechado pra aberto
  // (mesmo registrationId reaberto depois de cancelado não deve reaparecer
  // com o "Parcial"/valor da vez anterior). Ajuste de estado durante o
  // render (não num useEffect) — padrão recomendado pelo React pra "resetar
  // estado quando uma prop muda" sem o round-trip extra de um efeito.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRefundType('total')
      setAmount('')
      setSubmitting(false)
      setError(null)
      setSuccess(false)
    }
  }

  const amountNumber = Number(amount.replace(',', '.'))
  const amountValid = amountNumber > 0
  const canSubmit = !submitting && !success && (refundType !== 'parcial' || amountValid)

  async function handleConfirm() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await withdrawRegistration(
      registrationId,
      refundType,
      refundType === 'parcial' ? amountNumber : undefined,
    )
    setSubmitting(false)

    if (!result.ok) {
      setError(result.message ?? 'Não foi possível registrar a desistência.')
      return
    }
    setSuccess(true)
    setTimeout(() => onWithdrawn({ registrationId, refundType }), WITHDRAWN_CONFIRMATION_DELAY_MS)
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Jogador desistiu">
      <div className="withdraw-sheet stack">
        <h2>Jogador desistiu</h2>
        <p className="ssub">
          {pairLabel} · {categoryName}
        </p>

        <div className="withdraw-notice withdraw-notice--neutral" role="status">
          Decisão caso a caso — mesma lógica de estorno do Financeiro (total ou parcial).
        </div>

        <div className="field">
          <label>Tipo de estorno</label>
          <div className="tabs2">
            <button
              type="button"
              className={refundType === 'total' ? 'active' : ''}
              onClick={() => setRefundType('total')}
            >
              Total — {formatBRL(totalAmount)}
            </button>
            <button
              type="button"
              className={refundType === 'parcial' ? 'active' : ''}
              onClick={() => setRefundType('parcial')}
            >
              Parcial
            </button>
            <button
              type="button"
              className={refundType === 'nenhum' ? 'active' : ''}
              onClick={() => setRefundType('nenhum')}
            >
              Sem estorno
            </button>
          </div>
        </div>

        {refundType === 'parcial' ? (
          <div className="field">
            <label htmlFor="withdraw-amount">Valor a estornar</label>
            <div className="control">
              <input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
        {success ? (
          <div className="withdraw-notice withdraw-notice--success" role="status">
            Desistência registrada. Vaga liberada na categoria.
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-danger btn-md btn-full"
          disabled={!canSubmit}
          onClick={handleConfirm}
        >
          Confirmar desistência
        </button>

        <div className="foot-note">Libera a vaga na categoria imediatamente após confirmar.</div>
      </div>
    </BottomSheet>
  )
}
