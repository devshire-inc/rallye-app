import { useEffect, useState } from 'react'
import { acceptOffer, declineOffer } from '../../lib/api/waitlist'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Icon } from '../../components/ui/Icon/Icon'
import './OfferSheet.css'

export interface OfferResolvedResult {
  status: 'accepted' | 'declined' | 'expired'
}

export interface OfferSheetProps {
  entryId: string
  /** ISO/RFC3339 — fonte de verdade da contagem regressiva. */
  expiresAt: string
  /** Nome da turma + data/hora/quadra, já formatado pelo chamador — mesma
   * convenção de WaitlistSheet.classSchedule. */
  classSchedule: string
  teacherName: string
  activeEnrollments: number
  capacity: number
  /** Chamado depois que a oferta foi resolvida (aceita, recusada OU
   * expirada) — mesmo espírito de RemarcarSheet.onRescheduled: quem usa
   * este sheet decide se/como fecha. */
  onResolved: (result: OfferResolvedResult) => void
  onCancel: () => void
}

/** "HH:MM:SS" a partir de uma duração em ms — cópia exata do formato do
 * protótipo real (`#sheet-ag9`, ex. "01:59:47"), inclusive não deixando as
 * horas cortarem em 2 dígitos além de 99h+ (não é um caso real pra uma
 * janela de 2h, mas evita truncar silenciosamente se `expiresAt` vier
 * absurdo). */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

type Resolution = { message: string; tone: 'success' | 'neutral' | 'error' }

const RESOLUTION_ALERT_TONE: Record<Resolution['tone'], 'success' | 'info' | 'danger'> = {
  success: 'success',
  neutral: 'info',
  error: 'danger',
}

/**
 * AG9 — bottom sheet "Confirmação de vaga" (BEAC-1923, story BEAC-1708).
 * Cópia exata de `#sheet-ag9` no protótipo real (Artifact "Rallye —
 * Agenda") — título, footnote e formato do timer conferidos char-a-char
 * contra o HTML salvo do protótipo, não contra a descrição da task (ver
 * decisão desta story: doc/AC podem estar desatualizados quando divergem do
 * protótipo real — aqui os dois concordam, sem conflito a resolver).
 *
 * # Contagem regressiva — só visual, servidor decide a expiração de verdade
 *
 * O timer local (`setInterval` de 1s recomputando a partir de `expiresAt`,
 * nunca só decrementando um contador — evita deriva) é PURAMENTE visual.
 * Quando chega a zero, este componente chama exatamente o mesmo
 * `acceptOffer` do botão "Confirmar vaga" — o servidor quem decide se
 * resolve como expirado (POST /waitlist/{id}/accept devolve 200 com
 * `status:'expired'` quando o prazo já passou, NUNCA um erro HTTP: um 4xx
 * ali descartaria a promoção do próximo da fila que a mesma chamada faz,
 * ver comentário de pacote em offer_handler.go/rallye-api). Este componente
 * distingue os 2 casos pelo campo `status` da resposta, nunca pelo próprio
 * relógio do cliente.
 *
 * # Reskin DS (grupo "Agendamento", handover desta dispatch)
 *
 * Título próprio ("Abriu uma vaga pra você!") trocado pelo texto do node
 * Figma 163:5295 ("Vaga disponível!") — mesmo papel, cópia atualizada pra
 * bater char-a-char com o protótipo mais recente. Fica fora do header do
 * `BottomSheet` (que já mostra "Vaga disponível" via `label` em
 * `AG3StudentAgendaPage`) porque o Figma trata este título como parte do
 * bloco de ícone+título+subtítulo centralizado, não como um header de
 * sheet genérico — mantido inline para preservar esse layout. O timer
 * (Figma: bloco laranja sólido com número grande) não tem componente DS
 * equivalente (checado StepIndicator/Skeleton, nenhum cobre contagem
 * regressiva) — implementado com markup simples próprio.
 */
export function OfferSheet({
  entryId,
  expiresAt,
  classSchedule,
  teacherName,
  activeEnrollments,
  capacity,
  onResolved,
  onCancel,
}: OfferSheetProps) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [resolution, setResolution] = useState<Resolution | null>(null)

  useEffect(() => {
    // Achado do reviewer (BEAC-1708): parar de tiquetaquear assim que a
    // oferta é resolvida (aceita/recusada/expirada) — antes o interval só
    // parava no unmount, continuando a re-renderizar a cada segundo à toa
    // enquanto o setTimeout de 1200ms do fechamento não disparava.
    if (resolution) return
    const id = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [expiresAt, resolution])

  const expired = remainingMs <= 0

  async function handleAccept() {
    if (submitting || resolution) return
    setSubmitting(true)
    const result = await acceptOffer(entryId)
    setSubmitting(false)

    if (!result.ok) {
      setResolution({ message: 'Não foi possível confirmar a vaga agora. Tente novamente.', tone: 'error' })
      return
    }
    if (result.status === 'expired') {
      setResolution({
        message: 'O prazo pra confirmar esta vaga expirou — ela já passou pro próximo da fila.',
        tone: 'neutral',
      })
      setTimeout(() => onResolved({ status: 'expired' }), 1200)
      return
    }
    setResolution({ message: 'Vaga confirmada! A aula já apareceu na sua agenda.', tone: 'success' })
    setTimeout(() => onResolved({ status: 'accepted' }), 1200)
  }

  async function handleDecline() {
    if (submitting || resolution) return
    setSubmitting(true)
    const result = await declineOffer(entryId)
    setSubmitting(false)

    if (!result.ok) {
      setResolution({ message: 'Não foi possível recusar agora. Tente novamente.', tone: 'error' })
      return
    }
    setResolution({ message: 'Sem problema — a vaga passou pro próximo da fila.', tone: 'neutral' })
    setTimeout(() => onResolved({ status: 'declined' }), 1200)
  }

  useEffect(() => {
    if (!expired) return
    // setState só pode ser alcançado a partir do corpo do efeito dentro de
    // um callback assíncrono (.then), nunca síncrono na chamada direta —
    // mesmo padrão exigido pelo lint react-hooks/set-state-in-effect em
    // S1Page.tsx/LoginPage.tsx (handleAccept chama setSubmitting no início,
    // antes do primeiro await).
    Promise.resolve().then(() => handleAccept())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  return (
    <div className="offer-sheet">
      <div className="offer-sheet-head">
        <div className="offer-sheet-icon" aria-hidden="true">
          <Icon name="clock" size={28} />
        </div>
        <h2>Vaga disponível!</h2>
        <p className="ssub">{classSchedule}</p>
      </div>

      <div className="stack">
        {!resolution ? (
          <div className="offer-sheet-countdown" role="status">
            <span className="offer-sheet-countdown-value">{formatCountdown(remainingMs)}</span>
            <span className="offer-sheet-countdown-label">restantes para confirmar</span>
          </div>
        ) : null}

        <div className="offer-sheet-summary">
          <div className="srow">
            <span className="lbl">Professor</span>
            <span>{teacherName}</span>
          </div>
          <div className="srow">
            <span className="lbl">Turma</span>
            <span>
              {activeEnrollments}/{capacity} (a vaga é sua)
            </span>
          </div>
        </div>

        {!resolution ? (
          <div className="offer-sheet-actions">
            <Button variant="primary" size="lg" fullWidth loading={submitting} onClick={handleAccept}>
              Confirmar vaga
            </Button>
            <Button variant="ghost" size="sm" disabled={submitting} onClick={handleDecline}>
              Recusar e sair da fila
            </Button>
          </div>
        ) : (
          <div role={resolution.tone === 'error' ? 'alert' : 'status'}>
            <AlertCard tone={RESOLUTION_ALERT_TONE[resolution.tone]} showIcon>
              {resolution.message}
            </AlertCard>
          </div>
        )}

        <div className="foot-note">
          Recusar ou deixar o tempo esgotar passa a vaga pro próximo da fila automaticamente — sem penalidade.
        </div>
      </div>

      {!resolution ? (
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Fechar
        </Button>
      ) : null}
    </div>
  )
}
