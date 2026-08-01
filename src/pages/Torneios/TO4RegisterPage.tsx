import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
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
import '../../components/AuthLayout/AuthLayout.css'
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
 */
export default function TO4RegisterPage() {
  const { orgLabel, userLabel } = useShellIdentity()
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
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <PageLoading label="Carregando torneio" />
      </AppShell>
    )
  }

  if (state.status === 'error') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <p className="to4-loading">Não foi possível carregar este torneio.</p>
      </AppShell>
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
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <button
          type="button"
          className="back"
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
        >
          ‹ Torneio
        </button>
        <h1>Inscrição · {tournament.name}</h1>
        <div className="spacer" />
      </div>

      <div className="dash-body">
        <div className="field">
          <label htmlFor="to4-category">Categoria</label>
          <div className="control">
            <select
              id="to4-category"
              value={selectedCategoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {tournament.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {suggestion?.categoryId ? (
            <p className="hint">
              {capitalize(suggestion.reason)} — pode trocar livremente pra jogar em outra categoria.
            </p>
          ) : null}
        </div>

        {isDuplas && !manualMode ? (
          <div className="field">
            <label htmlFor="to4-partner">Sua dupla</label>
            <div className="control">
              <input
                id="to4-partner"
                type="text"
                placeholder="Buscar parceiro(a) na plataforma..."
                value={selectedPartner ? selectedPartner.user.name : partnerQuery}
                onChange={(e) => {
                  setSelectedPartner(null)
                  setPartnerQuery(e.target.value)
                }}
              />
            </div>
            {partnerResults.length > 0 && !selectedPartner && partnerQuery.trim() !== '' ? (
              <div className="card to4-partner-results">
                {partnerResults.map((m) => (
                  <button
                    key={m.membershipId}
                    type="button"
                    className="inv-row"
                    onClick={() => {
                      setSelectedPartner(m)
                      setPartnerResults([])
                    }}
                  >
                    <span className="iw">
                      <span className="nm">{m.user.name}</span>
                      <span className="desc">{m.user.email ?? ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="hint">
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
        ) : null}

        {isDuplas && manualMode ? (
          <>
            <div className="field">
              <label htmlFor="to4-partner-name">Nome do(a) parceiro(a)</label>
              <div className="control">
                <input
                  id="to4-partner-name"
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="to4-partner-email">E-mail do(a) parceiro(a)</label>
              <div className="control">
                <input
                  id="to4-partner-email"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </div>
              <p className="hint">
                A pessoa recebe um convite por e-mail pra criar conta.{' '}
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
          </>
        ) : null}

        <div className="card to4-summary">
          <div className="to4-summary-row">
            <span>Categoria</span>
            <span>{category?.name ?? '—'}</span>
          </div>
          {isDuplas ? (
            <div className="to4-summary-row">
              <span>Dupla</span>
              <span>Você / {partnerDisplayName ?? '—'}</span>
            </div>
          ) : null}
          <div className="to4-summary-row to4-summary-total">
            <span>Taxa de inscrição</span>
            <span>{tournament.entryFee > 0 ? formatBRL(tournament.entryFee) : 'Grátis'}</span>
          </div>
        </div>

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {successMessage ? <p role="status">{successMessage}</p> : null}

        <button
          type="button"
          className="btn btn-primary btn-md btn-full"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {buttonLabel}
        </button>

        <p className="foot-note">
          Inscrição confirma após o pagamento. Sem pagamento em 24h, a vaga é liberada. Cada
          jogador: 1 categoria por tipo (ex.: 1 feminina + 1 mista).
        </p>
      </div>
    </AppShell>
  )
}
