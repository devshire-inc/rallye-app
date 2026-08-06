import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { listMembers, type Member } from '../../lib/api/members'
import {
  getSuggestedCategory,
  getTournament,
  registerForCategory,
  type ApiFailure,
  type RegisterPayload,
  type SuggestedCategory,
  type Tournament,
  type TournamentCategory,
} from '../../lib/api/tournamentEnrollment'
import { formatBRL } from '../../lib/money'
import { getActiveUnitId } from '../../lib/tenantContext'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TO4RegisterPage.css'

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; tournament: Tournament }

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function registerErrorMessage(failure: ApiFailure): string {
  if (failure.error === 'category_full')
    return 'Esta categoria está lotada. Escolha outra categoria.'
  if (failure.error === 'duplicate_category_type') {
    return 'Você (ou sua dupla) já está inscrito em outra categoria deste mesmo tipo neste torneio.'
  }
  if (failure.error === 'invalid_body')
    return failure.message ?? 'Verifique os campos e tente novamente.'
  return 'Não foi possível concluir a inscrição. Tente novamente.'
}

/**
 * TO4 — Inscrição em torneio (BEAC-1990, story BEAC-1717 — "Sugestão de
 * categoria com base no nível de habilidade"). Markup/copy seguem o
 * protótipo real (Artifact "Rallye", `#scr-to4`): dropdown de categoria com
 * hint de sugestão, busca de parceiro + cadastro manual, resumo e CTA
 * condicionado à taxa do torneio.
 *
 * Dropdown de categoria SEM vaga ao vivo (decisão confirmada com o usuário
 * nesta dispatch): nenhum endpoint em escopo (suggested-category, register)
 * expõe ocupação de categoria de forma correta para um chamador sem
 * torneios:read — GET /tournament-categories/{id}/registrations (BEAC-1991,
 * story irmã BEAC-1718) restringe esse caso às próprias inscrições do
 * chamador, o que sub-contaria vagas ocupadas por outros jogadores. Uma
 * categoria só é conhecida como lotada ao tentar (409 category_full),
 * nunca desabilitada de antemão no <select>.
 *
 * Busca de parceiro reaproveita GET /units/{id}/members (mesmo padrão de
 * F4CreateInvoicePage.tsx) — não existe endpoint de busca dedicado de
 * "parceiros de torneio", e members já devolve id/nome/e-mail de toda
 * membership ativa da unit, a mesma fonte que POST .../register valida via
 * player2_id (hasActiveMembershipInUnit no backend).
 *
 * player1 é sempre o próprio chamador — inscrição em nome de terceiros
 * (que exigiria permission torneios:write) fica fora do escopo desta tela
 * self-service.
 *
 * Pós-inscrição: categoria paga devolve invoiceId -> navega para
 * /invoices/:invoiceId (F3InvoiceDetailPage, já existente, mostra link de
 * pagamento); categoria grátis confirma na hora -> mensagem de sucesso
 * inline, sem fatura para mostrar.
 *
 * ## Reskin design system (Figma "18 · Torneios — Inscrição", node 175:2269
 * mobile / 187:6748 desktop)
 *
 * - `Button` (primary/lg/fullWidth) no CTA, no lugar do `.btn.btn-primary`
 *   local — com isso o import de AuthLayout.css saiu daqui.
 * - `Badge tone="brand"` no chip "Sugerida p/ você" (175:2318), condicionado
 *   à sugestão real do backend.
 * - `Chip` (DS) foi avaliado e DESCARTADO para esse mesmo chip: é um
 *   `<button aria-pressed>` de filtro alternável (node 98:2), e aqui o chip
 *   é um rótulo estático dentro de um campo — um botão a mais na ordem de
 *   foco, sem ação. `EventStatusBadge` idem: os 5 status dele
 *   (convite/inscrito/abertas/lotado/encerrado) não incluem "sugerida".
 * - `Select`/`Input` do DS não foram adotados nesta passada: os controles
 *   desta tela ficam DENTRO dos cards de campo do frame (rótulo overline em
 *   cima, controle sem borda própria embaixo), enquanto os componentes do DS
 *   trazem borda/altura de controle isolado — encaixá-los exigiria
 *   sobrescrever por escopo justamente a anatomia que os define. Ficam os
 *   `<select>`/`<input>` nativos, estilizados por `.to4-select`/`.to4-input`.
 *
 * ## Layout único, coluna mais larga no desktop
 *
 * O frame desktop (187:6748) é o mesmo empilhamento do mobile numa coluna de
 * 640px — sem tabela, sem bloco reordenado. Segue o padrão de
 * F3InvoiceDetailPage: um layout só, e o "‹ Voltar" some em
 * BREAKPOINT_SHELL_DESKTOP_MIN.
 */
export default function TO4RegisterPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const unitId = getActiveUnitId()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [suggestion, setSuggestion] = useState<SuggestedCategory | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  // Ref (não state): só serve para o callback assíncrono de
  // getSuggestedCategory abaixo decidir se ainda pode aplicar a sugestão —
  // mudar isso nunca deve, por si só, re-renderizar a tela.
  const suggestionLockedRef = useRef(false)

  const [partnerQuery, setPartnerQuery] = useState('')
  const debouncedPartnerQuery = useDebouncedValue(partnerQuery, 300)
  const [partnerResults, setPartnerResults] = useState<Member[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Member | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    getTournament(tournamentId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', tournament: result.tournament })
      setSelectedCategoryId((current) => current || (result.tournament.categories[0]?.id ?? ''))
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    getSuggestedCategory(tournamentId).then((result) => {
      if (cancelled || !result.ok) return
      setSuggestion(result.suggestion)
      // Pré-seleciona a categoria sugerida assim que ela chegar — mas só se
      // o usuário ainda não tiver trocado a categoria manualmente
      // (suggestionLockedRef), pra "pode trocar livremente" (AC) nunca ser
      // sobrescrito por uma sugestão que chegou depois.
      if (!suggestionLockedRef.current && result.suggestion.categoryId) {
        setSelectedCategoryId(result.suggestion.categoryId)
        suggestionLockedRef.current = true
      }
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  useEffect(() => {
    if (!unitId || debouncedPartnerQuery.trim() === '' || selectedPartner) return
    let cancelled = false
    listMembers(unitId, debouncedPartnerQuery).then((result) => {
      if (cancelled || !result.ok) return
      setPartnerResults(result.members)
    })
    return () => {
      cancelled = true
    }
  }, [unitId, debouncedPartnerQuery, selectedPartner])

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId)
    suggestionLockedRef.current = true
    setSelectedPartner(null)
    setPartnerQuery('')
    setPartnerResults([])
    setManualMode(false)
    setManualName('')
    setManualEmail('')
  }

  function handlePickManual() {
    setManualMode(true)
    setSelectedPartner(null)
    setPartnerQuery('')
    setPartnerResults([])
  }

  function handleBackToSearch() {
    setManualMode(false)
    setManualName('')
    setManualEmail('')
  }

  if (state.status === 'loading') {
    return (
      <PageLoading label="Carregando torneio" />
    )
  }

  if (state.status === 'error') {
    return (
      <p className="to4-loading">Não foi possível carregar este torneio.</p>
    )
  }

  const { tournament } = state
  const category: TournamentCategory | null =
    tournament.categories.find((c) => c.id === selectedCategoryId) ?? null
  const isDuplas = category?.modality === 'duplas'

  const manualEmailValid = manualEmail.trim() !== '' && EMAIL_RE.test(manualEmail.trim())
  const hasValidPartner =
    !isDuplas || !!selectedPartner || (manualMode && manualName.trim() !== '' && manualEmailValid)
  const canSubmit = !!category && hasValidPartner && !submitting

  const manualDisplayName = manualMode ? manualName.trim() : ''
  const partnerDisplayName = selectedPartner?.user.name ?? (manualDisplayName || null)

  const buttonLabel =
    tournament.entryFee > 0 ? `Inscrever e pagar — ${formatBRL(tournament.entryFee)}` : 'Inscrever'

  async function handleSubmit() {
    if (!category || !canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)

    const payload: RegisterPayload = {}
    if (isDuplas) {
      if (selectedPartner) {
        payload.player2Id = selectedPartner.user.id
      } else {
        payload.player2ManualName = manualName.trim()
        payload.player2ManualEmail = manualEmail.trim()
      }
    }

    const result = await registerForCategory(category.id, payload)
    setSubmitting(false)
    if (!result.ok) {
      setErrorMessage(registerErrorMessage(result))
      return
    }

    if (result.registration.invoiceId) {
      navigate(`/invoices/${result.registration.invoiceId}`)
      return
    }
    setSuccessMessage(`Inscrição confirmada na categoria "${category.name}"!`)
  }

  return (
    <>
      <div className="pg-head">
        {/* `.to4-back` e não `.pg-head .back`: esse seletor genérico já colidiu
            entre CSS de página nesta leva (o bundle é único e a
            especificidade empata). Some no desktop, onde a sidebar já é a
            navegação — o frame 187:6748 não desenha retorno nenhum. */}
        <button
          type="button"
          className="to4-back"
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
        >
          ‹ Voltar
        </button>
        <h1>Inscrição</h1>
        <div className="spacer" />
      </div>

      <div className="dash-body to4-body">
        {/* Contexto do torneio (175:2311 / 188:2399): o nome saiu do `<h1>`
            (que agora é só "Inscrição", como no frame) e virou este bloco de
            duas linhas. Os emojis 🏆/💰 vêm de `::before` no CSS —
            decorativos, e no DOM só sujariam a busca por texto. */}
        <div className="to4-context">
          <p className="to4-context__name">{tournament.name}</p>
          <p className="to4-context__fee">
            {tournament.entryFee > 0 ? `${formatBRL(tournament.entryFee)} / dupla` : 'Grátis'}
          </p>
        </div>

        <div className="to4-field">
          <label className="to4-field__label" htmlFor="to4-category">
            Categoria
          </label>
          <div className="to4-field__control">
            <select
              id="to4-category"
              className="to4-select"
              value={selectedCategoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {tournament.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {/* Chip "Sugerida p/ você" do frame (175:2318) — só aparece quando
                a categoria escolhida é de fato a sugerida pelo backend, nunca
                como enfeite fixo. */}
            {suggestion?.categoryId && suggestion.categoryId === selectedCategoryId ? (
              <Badge tone="brand">Sugerida p/ você</Badge>
            ) : null}
          </div>
        </div>
        {suggestion?.categoryId ? (
          <p className="to4-hint">
            {capitalize(suggestion.reason)} — pode trocar livremente pra jogar em outra categoria.
          </p>
        ) : null}

        {isDuplas && !manualMode ? (
          <>
            <div className="to4-field">
              <label className="to4-field__label" htmlFor="to4-partner">
                Sua dupla
              </label>
              <div className="to4-field__control">
                <input
                  id="to4-partner"
                  className="to4-input"
                  type="text"
                  placeholder="🔍 Buscar por nome..."
                  value={selectedPartner ? selectedPartner.user.name : partnerQuery}
                  onChange={(e) => {
                    setSelectedPartner(null)
                    setPartnerQuery(e.target.value)
                  }}
                />
              </div>
            </div>
            {partnerResults.length > 0 && !selectedPartner && partnerQuery.trim() !== '' ? (
              <div className="to4-partner-results">
                {partnerResults.map((m) => (
                  <button
                    key={m.membershipId}
                    type="button"
                    className="to4-partner-result"
                    onClick={() => {
                      setSelectedPartner(m)
                      setPartnerResults([])
                    }}
                  >
                    <span className="to4-partner-result__name">{m.user.name}</span>
                    <span className="to4-partner-result__email">{m.user.email ?? ''}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {/* O frame (175:2327) desenha o bloco "ou cadastre manualmente"
                SEMPRE visível, ao lado da busca. Aqui ele continua atrás do
                toggle `manualMode`: a validação de `hasValidPartner` é
                exclusiva (ou parceiro da plataforma, ou nome+e-mail manuais),
                e mostrar os dois ao mesmo tempo mudaria a regra de submissão —
                lógica de negócio, fora do escopo de um reskin. O bloco abaixo
                é o mesmo card do frame, só que revelado pelo link. */}
            <div className="to4-manual-teaser">
              <p className="to4-manual-teaser__title">ou cadastre manualmente</p>
              <p className="to4-hint">
                Não achou?{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    handlePickManual()
                  }}
                >
                  Cadastrar parceiro(a) manualmente
                </a>{' '}
                — a pessoa recebe convite pra criar conta.
              </p>
            </div>
          </>
        ) : null}

        {isDuplas && manualMode ? (
          <div className="to4-manual">
            <p className="to4-manual__title">ou cadastre manualmente</p>
            <div className="to4-field to4-field--plain">
              <label className="to4-field__label" htmlFor="to4-partner-name">
                Nome do(a) parceiro(a)
              </label>
              <div className="to4-field__control">
                <input
                  id="to4-partner-name"
                  className="to4-input"
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
            </div>
            <div className="to4-field to4-field--plain">
              <label className="to4-field__label" htmlFor="to4-partner-email">
                E-mail do(a) parceiro(a)
              </label>
              <div className="to4-field__control">
                <input
                  id="to4-partner-email"
                  className="to4-input"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </div>
            </div>
            <p className="to4-hint">
              Parceiro sem conta no Rallye recebe um convite.{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  handleBackToSearch()
                }}
              >
                ‹ Buscar na plataforma
              </a>
            </p>
          </div>
        ) : null}

        <div className="to4-summary">
          <h2 className="to4-summary__title">Resumo</h2>
          <p className="to4-summary__row">Categoria: {category?.name ?? '—'}</p>
          {isDuplas ? (
            <p className="to4-summary__row">Dupla: Você / {partnerDisplayName ?? '—'}</p>
          ) : null}
          <p className="to4-summary__row to4-summary__row--total">
            Taxa: {tournament.entryFee > 0 ? formatBRL(tournament.entryFee) : 'Grátis'}
          </p>
        </div>

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {successMessage ? <p role="status">{successMessage}</p> : null}

        <Button variant="primary" size="lg" fullWidth disabled={!canSubmit} onClick={handleSubmit}>
          {buttonLabel}
        </Button>

        {/* Frame 175:2339. A segunda frase não está no Figma mas carrega uma
            regra real do backend (1 categoria por tipo, erro
            `duplicate_category_type` tratado em `registerErrorMessage`) que
            já estava nesta tela — apagá-la seria perder informação, não
            reskin. A linha do PIX só aparece quando há taxa: categoria
            gratuita confirma na hora, sem etapa de pagamento. */}
        <p className="to4-footnote">
          {tournament.entryFee > 0 ? 'Pagamento via PIX na próxima etapa · expira em 24h. ' : ''}
          Cada jogador: 1 categoria por tipo (ex.: 1 feminina + 1 mista).
        </p>
      </div>
    </>
  )
}
