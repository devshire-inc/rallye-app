import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { BottomSheet } from '../../components/BottomSheet/BottomSheet'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Icon } from '../../components/ui/Icon/Icon'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { listInvoices, type InvoiceListItem } from '../../lib/api/invoices'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; overdue: InvoiceListItem[] }

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/**
 * 15 — Bloqueado por Inadimplência (Aluno). Figma "Rallye — Protótipo",
 * node 165:4803 (mobile) / 186:2246 (desktop). Tela NOVA: não existia
 * nenhuma página para este estado antes desta task.
 *
 * # O bloqueio é real — o backend já o aplica e já o comunica
 *
 * `public.units.delinquency_block_level` (`new_bookings_only` |
 * `new_bookings_and_checkin` | `total`, migrations/000028) é lido por
 * `middleware.CheckDelinquencyBlock`
 * (rallye-api/api/middleware/delinquency_check.go), que os handlers de
 * domínio chamam antes de gravar. Quando bloqueia, a resposta é 403 com
 * `{"error": "delinquency_blocked", "message": "Não foi possível concluir:
 * mensalidade em atraso desde AAAA-MM-DD."}` — o título desta tela ("Não foi
 * possível concluir") é literalmente essa mensagem do backend.
 *
 * Handlers que devolvem esse 403 hoje: bookings.CreateHandler,
 * bookings.AttendanceHandler, bookings.ParticipantsHandler,
 * enrollments.CreateHandler e dayuse.BookHandler. Destes, o ÚNICO com um
 * fluxo self-service de aluno neste app é o Day Use (DU3,
 * DayUseConfirmPage.tsx) — os outros quatro são acionados por
 * recepção/professor (criar reserva, adicionar aluno avulso, check-in de
 * turma, matricular aluno), e esta tela é a visão do ALUNO ("Sua
 * mensalidade..."), não faria sentido mostrá-la para quem operou a ação.
 * Por isso a tela está ligada a partir de DU3 e só dela — ver o comentário
 * em DayUseConfirmPage.tsx.
 *
 * GAP CONHECIDO (não fabricado): o agendamento self-service de aula em turma
 * (POST /units/{id}/classes/{classId}/occurrences/book,
 * classoccurrences.BookHandler) NÃO chama CheckDelinquencyBlock — é o
 * endpoint mais novo e simplesmente não foi plugado ao middleware. Quando
 * for, AgendarConfirmarPage.tsx passa a poder navegar pra cá com a mesma
 * checagem de `error === 'delinquency_blocked'` que DU3 já faz; nada nesta
 * tela precisa mudar.
 *
 * # De onde vêm os dados do card de dívida — nenhum campo inventado
 *
 * Não existe (nem no backend nem no wire) um campo "aluno está bloqueado":
 * o próprio comentário de pacote de delinquency_check.go diz que
 * "inadimplente" é calculado ao vivo como "existe pelo menos 1
 * public.invoices com status='atrasada' para este student_id", e a data do
 * "desde" é `MIN(due_date)` dessas faturas.
 *
 * Esta tela reproduz exatamente essa definição a partir do que o aluno já
 * pode ler: GET /units/{id}/invoices?status=atrasada — o MESMO endpoint de
 * F5 (Minhas Faturas), que o backend já escopa para "só as próprias
 * faturas" quando o chamador não tem `financeiro:read`. A fatura mais antiga
 * dá o "em atraso desde" e o card de dívida (descrição, valor e
 * `days_overdue`, que o backend calcula em list.go). Se a lista voltar
 * vazia, o aluno não está inadimplente — a tela diz isso em vez de fingir um
 * bloqueio.
 *
 * # Copy
 *
 * O subtítulo do frame ("Regularize para voltar a agendar aulas e fazer
 * check-in") é mantido literal. Ele descreve o nível
 * `new_bookings_and_checkin`; o nível real da arena não é legível por um
 * aluno (GET /units/{id}/settings/delinquency-block-level exige
 * `config:read`), então adaptar a frase ao nível configurado exigiria um
 * dado que esta sessão não tem — melhor a copy do design do que uma
 * suposição.
 *
 * # "Falar com a arena"
 *
 * O botão secundário do frame não tem destino possível hoje: nenhum endpoint
 * legível pelo aluno devolve telefone/WhatsApp da unidade
 * (`public.units.phone` existe, mas só é escrito por POST /tenants/{id}/units
 * — não há GET que o exponha). Em vez de inventar um `tel:`/`wa.me`, o botão
 * abre um BottomSheet explicando — mesmo tratamento que PL4 já dá ao
 * [CANCELAR ASSINATURA] sem endpoint.
 *
 * # Layout
 *
 * Coluna única centrada nos dois frames (mobile 375, desktop 520px) — sem
 * tabela, sem `dash-body--wide`. A única diferença entre eles é a largura e
 * a escala do texto, resolvidas por @media em BREAKPOINT_SHELL_DESKTOP_MIN.
 */
export default function BlockedByDelinquencyPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showContactInfo, setShowContactInfo] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      listInvoices(unitId, { status: 'atrasada' })
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', overdue: result.invoices })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  /* Mesma regra do backend (DelinquencySince: `MIN(due_date)` das faturas
     atrasadas) — a mais antiga é a que define o "em atraso desde" e é a que
     o CTA abre. */
  const oldest = useMemo(() => {
    if (state.status !== 'ready' || state.overdue.length === 0) return null
    return state.overdue.reduce((acc, invoice) => (invoice.dueDate < acc.dueDate ? invoice : acc))
  }, [state])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="dash-body blk-body">
        {state.status === 'loading' ? (
          <PageLoading label="Verificando suas faturas" variant="section" />
        ) : null}

        {state.status === 'error' ? (
          <div className="blk-alert" role="alert">
            <AlertCard tone="danger" showIcon>
              Não foi possível verificar suas faturas agora.
            </AlertCard>
          </div>
        ) : null}

        {state.status === 'ready' && !oldest ? (
          <EmptyState
            icon={<Icon name="check-circle" size={40} />}
            title="Tudo em dia!"
            description="Você não tem nenhuma fatura em atraso — seu acesso está liberado."
            actionLabel="Voltar ao início"
            onAction={() => unitId && navigate(`/units/${unitId}/dashboard`)}
          />
        ) : null}

        {oldest ? (
          <div className="blk-panel">
            {/* "!" é um nó de texto no frame (node 165:4838), não um ícone
                exportado — por isso um <span> e não um `ui/Icon`. */}
            <div className="blk-mark" aria-hidden="true">
              !
            </div>

            <div className="blk-title">
              <h1 className="blk-title__heading">Não foi possível concluir</h1>
              <p className="blk-title__text">
                Sua mensalidade está em atraso desde {formatDate(oldest.dueDate)}. Regularize para
                voltar a agendar aulas e fazer check-in.
              </p>
            </div>

            <div className="blk-debt">
              <span className="blk-debt__title">{oldest.description}</span>
              <span className="blk-debt__amount">
                {formatBRL(oldest.amount)}
                {oldest.daysOverdue !== null
                  ? ` · atraso de ${oldest.daysOverdue} ${oldest.daysOverdue === 1 ? 'dia' : 'dias'}`
                  : ''}
              </span>
            </div>

            {/* Abre F3 (detalhe da fatura), que é onde vive o [PAGAR AGORA]
                apontando pro `payment_link` real — a listagem não devolve esse
                campo (mesma razão já documentada em F5MyInvoicesPage.tsx). Não
                há gateway de pagamento no app (decisão de produto). */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(`/invoices/${oldest.id}`)}
            >
              Ver fatura e regularizar
            </Button>

            <div className="blk-contact">
              <Button variant="ghost" size="md" fullWidth onClick={() => setShowContactInfo(true)}>
                Falar com a arena
              </Button>
            </div>

            {state.status === 'ready' && state.overdue.length > 1 ? (
              <button
                type="button"
                className="blk-all-link"
                onClick={() => unitId && navigate(`/units/${unitId}/my-invoices`)}
              >
                Ver todas as {state.overdue.length} faturas em atraso
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <BottomSheet
        open={showContactInfo}
        onClose={() => setShowContactInfo(false)}
        label="Falar com a arena"
      >
        {/* `.blk-sheet` e não a `.stack` genérica: aquela mora em
            AuthLayout.css/OfferSheet.css/… e só existiria aqui por acidente de
            bundle — esta página não importa nenhuma das duas. */}
        <div className="blk-sheet">
          {/* Sem <h2> repetindo o título: o próprio `BottomSheet` já renderiza
              o `label` como cabeçalho da folha. */}
          <p className="blk-sheet-text">
            O app ainda não expõe o contato da arena — nenhum endpoint devolve telefone ou WhatsApp
            da unidade nesta versão. Procure a recepção da arena para negociar ou tirar dúvidas
            sobre esta fatura.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowContactInfo(false)}>
            Entendi
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  )
}
