import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Icon } from '../../components/ui/Icon/Icon'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import { Pill } from '../../components/ui/Pill/Pill'
import { Toast } from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { getInvoice } from '../../lib/api/invoices'
import {
  createPixCharge,
  getPixPayment,
  isMockProvider,
  isPixConfirmed,
  isPixExpired,
  isPixPending,
  type ApiFailure,
  type PixPayment,
} from '../../lib/api/pixPayments'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'

/**
 * 5s. A confirmação desta cobrança é MANUAL (um admin registra o pagamento do
 * outro lado — ver o comentário de pacote de ../../lib/api/pixPayments.ts), ou
 * seja, pode não chegar nunca dentro da sessão do aluno. Um intervalo curto não
 * antecipa nada que dependa do relógio, só reduz a latência percebida quando a
 * confirmação de fato acontece; 5s é o suficiente para parecer imediato sem
 * transformar uma tela parada em tráfego contínuo.
 */
const POLL_INTERVAL_MS = 5_000

/** Falha de rede/HTTP transportada como exceção, para o `data` das queries ser
 * `PixPayment` puro em vez de uma união com falha (mesmo recurso de
 * `MeUnavailableError` em ../../lib/query/identity.ts). */
class PixUnavailableError extends Error {
  readonly failure: ApiFailure

  constructor(failure: ApiFailure) {
    super(`PIX request failed: ${failure.error}`)
    this.name = 'PixUnavailableError'
    this.failure = failure
  }
}

const NETWORK_FAILURE: ApiFailure = { ok: false, status: 0, error: 'network_error' }

function failureOf(error: unknown): ApiFailure {
  return error instanceof PixUnavailableError ? error.failure : NETWORK_FAILURE
}

/** Copy do estado de falha por causa. Só as causas transitórias oferecem
 * "Tentar novamente": num 409 (fatura não é mais pagável) ou num 404 repetir a
 * chamada dá exatamente o mesmo erro, e um botão que não pode funcionar é pior
 * que nenhum. */
function emissionErrorCopy(failure: ApiFailure): {
  title: string
  description: string
  retryable: boolean
} {
  if (failure.status === 409) {
    return {
      title: 'Fatura não está em aberto',
      description:
        'Esta fatura já foi paga, cancelada ou estornada, então não é possível gerar uma cobrança PIX para ela.',
      retryable: false,
    }
  }
  if (failure.status === 404) {
    return {
      title: 'Fatura não encontrada',
      description: 'Não localizamos esta fatura. Volte para a lista e tente abri-la novamente.',
      retryable: false,
    }
  }
  if (failure.status === 403) {
    return {
      title: 'Sem acesso a esta fatura',
      description: 'Esta fatura não é sua, então não é possível gerar uma cobrança PIX para ela.',
      retryable: false,
    }
  }
  /* Rede, 5xx e qualquer erro não mapeado — a cópia do frame 13b
     (node 187:7119), que é justamente o caso "tente de novo". */
  return {
    title: 'Pagamento não aprovado',
    description: 'Não conseguimos confirmar o PIX. Tente novamente ou gere um novo código.',
    retryable: true,
  }
}

/** mm:ss do tempo restante; null quando não há prazo conhecido ou já venceu. */
function countdownLabel(expiresAt: string | null, now: number): string | null {
  if (expiresAt === null) return null
  const expiresAtMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs)) return null
  const remainingMs = expiresAtMs - now
  if (remainingMs <= 0) return null
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Bloco terminal (erro/expirado/confirmado) — a estrutura do frame 13b
 * (node 187:7119): slot circular com ícone, título, descrição e até duas
 * ações empilhadas. `ui/EmptyState` foi avaliado e descartado aqui: ele só
 * comporta UMA ação, e os dois frames de saída desta tela têm duas
 * ("Tentar novamente" + "Voltar"). */
function PixOutcome({
  tone,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  tone: 'danger' | 'success'
  title: string
  description: string
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel: string
  onSecondary: () => void
}) {
  return (
    <div className={`pix-outcome pix-outcome--${tone}`} role="alert">
      <span className="pix-outcome__icon" aria-hidden="true">
        <Icon name={tone === 'danger' ? 'alert-triangle' : 'check-circle'} size={40} />
      </span>
      <h1 className="pix-outcome__title">{title}</h1>
      <p className="pix-outcome__text">{description}</p>
      {primaryLabel && onPrimary ? (
        <Button variant="primary" size="md" fullWidth onClick={onPrimary}>
          {primaryLabel}
        </Button>
      ) : null}
      <Button variant="secondary" size="md" fullWidth onClick={onSecondary}>
        {secondaryLabel}
      </Button>
    </div>
  )
}

/**
 * 13 — Pagamento PIX (Aluno). Figma "13 · Pagamento PIX" node 164:4669
 * (mobile) / 186:2208 (desktop), mais a variante de erro "13b · Pagamento PIX
 * — Erro" node 187:7119.
 *
 * ONDE ESTA TELA VIVE: rota /invoices/:invoiceId/pix, filha da rota de F3
 * (/invoices/:invoiceId) e NÃO unit-scoped pelo mesmo motivo que F3 — os dois
 * endpoints que ela consome resolvem a unit da SESSÃO do chamador, não do
 * path. Chega-se nela pelo CTA "Pagar agora" da visão Aluno em
 * F3InvoiceDetailPage; F5 (Minhas Faturas) continua mandando para F3, como já
 * fazia (a listagem não devolve dados de pagamento, só o detalhe).
 *
 * POR QUE O CTA DEIXOU DE ABRIR O `payment_link`: até agora "Pagar agora"
 * abria numa aba o `payment_link` que o backend gravava na fatura — um campo
 * de texto livre, sem cobrança nenhuma por trás. Com POST
 * /invoices/{id}/payments/pix existe um recurso de cobrança de verdade
 * (com id, prazo e status consultável), então o CTA passa a emitir a cobrança
 * e navegar para cá. O `payment_link` NÃO foi removido: continua exibido na
 * caixa "copiar link" de F3 para as duas visões, porque é um dado real que o
 * admin pode ter cadastrado apontando para outro meio de pagamento (boleto,
 * checkout externo) — o que ele não é mais é o CTA principal do aluno.
 *
 * FLUXO E POLLING:
 * 1. Na montagem, POST /invoices/{id}/payments/pix. O endpoint é idempotente
 *    na prática (201 cria, 200 reaproveita a `pending` existente), então
 *    montar/remontar a tela não gera cobranças duplicadas — é por isso que ele
 *    cabe num `useQuery` em vez de exigir uma mutation disparada por efeito.
 * 2. Enquanto a cobrança está `pending`, GET /payments/{id} a cada 5s via
 *    `refetchInterval`. O polling PARA sozinho assim que o estado deixa de ser
 *    pendente (o `refetchInterval` em forma de função devolve `false`), sem
 *    nenhum `clearInterval` manual.
 * 3. A resposta traz `invoice_status` junto de propósito, então o polling é
 *    UMA chamada só — não há um GET /invoices/{id} em paralelo para saber se a
 *    fatura foi paga.
 *
 * NÃO EXISTE "JÁ PAGUEI": o backend não expõe nenhum endpoint de confirmação
 * que o aluno possa chamar (a confirmação mockada exige financeiro:write e uma
 * env ligada). A cobrança só sai de `pending` se um admin registrar o
 * pagamento. Um botão que marcasse a tela como paga seria mentira de UI, então
 * a tela espera — e diz que está esperando.
 *
 * EXPIRAÇÃO: a cobrança vence em 30 min (`expires_at`). A tela mostra a
 * contagem regressiva e, ao chegar a zero, entra no estado "código expirado"
 * já pelo relógio do cliente, sem esperar o servidor — o backend concorda na
 * consulta seguinte (uma `pending` vencida vira `expired`). Daí a única saída é
 * "Gerar novo código", que refaz o POST (a cobrança anterior está vencida,
 * então o backend emite uma nova).
 *
 * HONESTIDADE SOBRE O MOCK — o ponto mais delicado desta tela. O `qr_code` que
 * o backend devolve é deliberadamente impagável: não é um BR Code EMV válido e
 * nenhum app de banco o lê. Por isso:
 * - NÃO se gera imagem de QR Code a partir dele. O slot do QR dos frames é
 *   ocupado por um bloco explicativo, não por um código que fingiria funcionar
 *   ao ser apontado para a câmera.
 * - Um `ui/Pill` "AMBIENTE DE TESTE" e um `ui/AlertCard` informativo dizem, em
 *   texto, que não há pagamento real e que a confirmação depende da arena.
 * - O "copia e cola" continua lá, com o valor REAL da API, porque é o que a
 *   cobrança de fato é: uma string mock. O rótulo do botão preserva o do frame.
 * Nada disso é decorativo — os avisos só aparecem quando `mock`/`provider` da
 * própria resposta dizem que a cobrança não é pagável (`isMockProvider`), então
 * o dia em que houver gateway de verdade a tela para de dizer que não há.
 *
 * LAYOUT ÚNICO, sem tabela: os dois frames mostram a mesma coluna centralizada
 * (480px no desktop). A única diferença é o topo — "‹ Voltar" no mobile,
 * breadcrumb no desktop —, resolvida por @media em BREAKPOINT_SHELL_DESKTOP_MIN
 * (860), com os dois no DOM e sem `matchMedia`, exatamente como F3.
 *
 * GAP CONHECIDO (aceito): o estado "pagamento confirmado" não tem frame no
 * Figma — o protótipo só desenha pendente e erro. Como ele é alcançável de
 * verdade (admin registra o pagamento com a tela aberta), foi construído com o
 * mesmo bloco do 13b em tom de sucesso, em vez de deixar a tela presa no
 * "aguardando" depois que o pagamento entrou.
 */
export default function PixPaymentPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const { message, variant, showError, showSuccess, dismiss } = useToast()
  const [copyLabel, setCopyLabel] = useState('COPIAR')
  const [now, setNow] = useState(() => Date.now())

  /* Emissão da cobrança. `staleTime: Infinity` + sem refetch em foco porque
     ESTE é o POST: quem revalida o estado é a query de polling abaixo, e um
     refetch em foco aqui só repetiria a emissão à toa. `retry: false` porque
     403/404/409 são definitivos e a tela quer mostrar a causa, não insistir. */
  const chargeQuery = useQuery({
    queryKey: ['pix', 'charge', invoiceId],
    queryFn: async (): Promise<PixPayment> => {
      const result = await createPixCharge(invoiceId!)
      if (!result.ok) throw new PixUnavailableError(result)
      return result.payment
    },
    enabled: Boolean(invoiceId),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })

  /* Descrição da fatura para o subtítulo ("Mensalidade Mar/2026 · R$ 315,00"):
     o valor vem da própria cobrança, mas a descrição não está no shape de
     pagamento. Query SEPARADA e não bloqueante de propósito — se ela falhar, o
     subtítulo cai só no valor e a tela de pagamento continua funcionando, que é
     o que importa aqui. É também o que torna a rota linkável direto, sem
     depender de state de navegação vindo de F3. */
  const invoiceQuery = useQuery({
    queryKey: ['pix', 'invoice', invoiceId],
    queryFn: async () => {
      const result = await getInvoice(invoiceId!)
      if (!result.ok) throw new Error(result.error)
      return result.invoice
    },
    enabled: Boolean(invoiceId),
    retry: false,
  })

  const paymentId = chargeQuery.data?.paymentId ?? null

  /* Polling. `initialData` semeada com a resposta do POST (que é o mesmo
     shape) e `initialDataUpdatedAt` no instante em que ela chegou: com
     `staleTime` de um intervalo, isso evita o GET redundante que aconteceria
     no mesmo tick da emissão — o primeiro polling sai ~5s depois, como
     deveria. */
  const pollQuery = useQuery({
    queryKey: ['pix', 'payment', paymentId],
    queryFn: async (): Promise<PixPayment> => {
      const result = await getPixPayment(paymentId!)
      if (!result.ok) throw new PixUnavailableError(result)
      return result.payment
    },
    enabled: paymentId !== null,
    initialData: chargeQuery.data,
    initialDataUpdatedAt: chargeQuery.dataUpdatedAt,
    staleTime: POLL_INTERVAL_MS,
    retry: false,
    /* Forma de função: o próprio dado em cache decide se há um próximo tick.
       Deixa de ser pendente (confirmado, expirado ou vencido no relógio) ->
       `false` -> o polling para. Sem efeito, sem timer manual. */
    refetchInterval: (query) => {
      const data = query.state.data
      return data && isPixPending(data, Date.now()) ? POLL_INTERVAL_MS : false
    },
  })

  const payment = pollQuery.data ?? chargeQuery.data ?? null
  const pending = payment !== null && isPixPending(payment, now)

  /* Tique de 1s do contador — só enquanto a cobrança está pendente. Quando o
     prazo zera, `pending` vira false, o efeito limpa o intervalo e a tela
     passa sozinha para o estado expirado. */
  useEffect(() => {
    if (!pending) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [pending])

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopyLabel('COPIADO!')
        showSuccess('Código PIX copiado.')
        setTimeout(() => setCopyLabel('COPIAR'), 2000)
      },
      () => showError('Não foi possível copiar o código.'),
    )
  }

  function goBack() {
    navigate(-1)
  }

  const amountLabel = payment ? formatBRL(payment.amount) : null
  const description = invoiceQuery.data?.description ?? null
  const subtitle =
    description && amountLabel ? `${description} · ${amountLabel}` : (amountLabel ?? null)

  const confirmed = payment !== null && isPixConfirmed(payment)
  const expired = payment !== null && isPixExpired(payment, now)
  const remaining = payment && pending ? countdownLabel(payment.expiresAt, now) : null

  return (
    <>
      {/* Mesmo par voltar/breadcrumb de F3 (os dois no DOM, a @media escolhe). */}
      <div className="pg-head pix-head">
        <button type="button" className="back pix-nav-back" onClick={goBack}>
          ‹ Voltar
        </button>
        <nav className="pix-nav-crumbs" aria-label="Trilha de navegação">
          <button type="button" className="pix-nav-crumbs__link" onClick={goBack}>
            Fatura
          </button>
          <Icon name="chevron-right" size={12} />
          <span className="pix-nav-crumbs__current">Pagar com PIX</span>
        </nav>
        <div className="spacer" />
      </div>

      <div className="dash-body pix-body">
        {chargeQuery.isPending ? (
          <PageLoading label="Gerando cobrança PIX" variant="section" />
        ) : null}

        {chargeQuery.isError
          ? (() => {
              const copy = emissionErrorCopy(failureOf(chargeQuery.error))
              return (
                <PixOutcome
                  tone="danger"
                  title={copy.title}
                  description={copy.description}
                  primaryLabel={copy.retryable ? 'Tentar novamente' : undefined}
                  onPrimary={copy.retryable ? () => void chargeQuery.refetch() : undefined}
                  secondaryLabel="Voltar"
                  onSecondary={goBack}
                />
              )
            })()
          : null}

        {payment && confirmed ? (
          <PixOutcome
            tone="success"
            title="Pagamento confirmado"
            description="A arena registrou o pagamento desta fatura. Você já pode voltar para o detalhe da fatura."
            secondaryLabel="Ver fatura"
            onSecondary={goBack}
          />
        ) : null}

        {payment && !confirmed && expired ? (
          <PixOutcome
            tone="danger"
            title="Código expirado"
            description="Esta cobrança PIX passou do prazo de 30 minutos. Gere um novo código para continuar."
            primaryLabel="Gerar novo código"
            onPrimary={() => void chargeQuery.refetch()}
            secondaryLabel="Voltar"
            onSecondary={goBack}
          />
        ) : null}

        {payment && pending ? (
          <>
            <header className="pix-header">
              <h1 className="pix-header__title">Pagar com PIX</h1>
              {subtitle ? <p className="pix-header__subtitle">{subtitle}</p> : null}
            </header>

            {/* Slot do QR dos frames. NÃO renderiza um QR: o `qr_code` da API é
                uma string mock impagável, e desenhar um código que a câmera de
                um app de banco tentaria ler seria enganar o usuário.

                O aviso é curto DE PROPÓSITO e mora em dois lugares com papéis
                diferentes: aqui, no lugar exato onde o usuário procuraria o
                código para escanear ("não tem QR"), e no AlertCard abaixo, o
                porquê e a consequência ("não movimenta dinheiro; quem confirma
                é a arena"). Repetir a explicação inteira nos dois empurrava o
                CTA para fora da primeira dobra no mobile — o frame é compacto,
                e um aviso que esconde o botão principal também é um problema. */}
            {isMockProvider(payment) ? (
              <div className="pix-qr-slot">
                <span className="pix-qr-slot__icon" aria-hidden="true">
                  <Icon name="qr-code" size={32} />
                </span>
                <Pill className="pix-qr-slot__pill">
                  <b>AMBIENTE DE TESTE</b>
                </Pill>
                <p className="pix-qr-slot__text">Sem QR Code para escanear.</p>
              </div>
            ) : null}

            {isMockProvider(payment) ? (
              <AlertCard tone="info" showIcon>
                Cobrança de demonstração: o código não abre em nenhum app de banco e não movimenta
                dinheiro. A fatura só é marcada como paga quando a arena registrar o pagamento.
              </AlertCard>
            ) : null}

            <div className="pix-code">
              <code className="pix-code__value">{payment.qrCode}</code>
              <Button variant="ghost" size="sm" onClick={() => copyCode(payment.qrCode)}>
                {copyLabel}
              </Button>
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={() => copyCode(payment.qrCode)}>
              Copiar código PIX
            </Button>

            {/* `clock` e não `alert-triangle`: aguardar confirmação é o estado
                NORMAL desta tela (a confirmação é manual e pode demorar), não
                um problema — é também o ⏳ do frame. */}
            <p className="pix-waiting" role="status">
              <Icon name="clock" size={14} />
              <span>
                Aguardando confirmação do pagamento
                {remaining ? ` · expira em ${remaining}` : null}
              </span>
            </p>
          </>
        ) : null}
      </div>

      <Toast message={message} variant={variant} onDismiss={dismiss} />
    </>
  )
}
