import { type FormEvent, useState } from 'react'
import { RedeemInviteError, redeemInvite, type RedeemInviteResult } from '../../lib/api'
import './EnterArenaSheet.css'

export interface EnterArenaSheetProps {
  /**
   * Called once the invite is successfully redeemed. This component only
   * owns the form itself — the caller (today, the S1 stub, BEAC-1808) is
   * responsible for closing the surrounding BottomSheet and confirming to
   * the user, since the real S1 arena list (BEAC-1623) doesn't exist yet.
   * Once it does, this same callback should also trigger a refresh of the
   * real list.
   */
  onSuccess: (result: RedeemInviteResult) => void
}

type FeedbackKind = 'none' | 'not_found' | 'expired' | 'already_member' | 'internal_error'

// Exact copy locked by BEAC-1808's spec — do not paraphrase.
const NOT_FOUND_MESSAGE = 'Código não encontrado'
const EXPIRED_MESSAGE = 'Código expirado. Peça um novo.'
const ALREADY_MEMBER_MESSAGE = 'Você já faz parte desta arena!'
const GENERIC_ERROR_MESSAGE = 'Não foi possível entrar na arena agora. Tente novamente.'

/**
 * Invite-redemption form rendered inside a BottomSheet (BEAC-1808): a code
 * field, submit, and the 4 backend outcomes. `already_member` is
 * intentionally rendered as neutral/info (role="status", warning-toned, not
 * red) — the user isn't wrong, they're just already in.
 */
export function EnterArenaSheet({ onSuccess }: EnterArenaSheetProps) {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<FeedbackKind>('none')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(value: string) {
    setCode(value)
    if (feedback !== 'none') setFeedback('none')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const result = await redeemInvite(trimmed)
      onSuccess(result)
    } catch (err) {
      if (err instanceof RedeemInviteError) {
        if (err.code === 'invite_not_found') setFeedback('not_found')
        else if (err.code === 'invite_expired') setFeedback('expired')
        else if (err.code === 'already_member') setFeedback('already_member')
        else setFeedback('internal_error')
      } else {
        setFeedback('internal_error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isError = feedback === 'not_found' || feedback === 'expired' || feedback === 'internal_error'
  const isInfo = feedback === 'already_member'

  return (
    <div className="enter-arena-sheet">
      <h2>Entrar em nova arena</h2>
      <p className="section-desc">Digite o código de convite que você recebeu.</p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="field">
          <label htmlFor="invite-code">Código do convite</label>
          <div className="control">
            <input
              id="invite-code"
              name="invite-code"
              type="text"
              autoComplete="off"
              placeholder="Ex: ABC123"
              value={code}
              disabled={submitting}
              onChange={(e) => handleChange(e.target.value)}
            />
          </div>
        </div>

        {isError && (
          <p role="alert" className="enter-arena-sheet__feedback enter-arena-sheet__feedback--error">
            {feedback === 'not_found' && NOT_FOUND_MESSAGE}
            {feedback === 'expired' && EXPIRED_MESSAGE}
            {feedback === 'internal_error' && GENERIC_ERROR_MESSAGE}
          </p>
        )}

        {isInfo && (
          <p role="status" className="enter-arena-sheet__feedback enter-arena-sheet__feedback--info">
            {ALREADY_MEMBER_MESSAGE}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-md btn-full" disabled={submitting || !code.trim()}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
