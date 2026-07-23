import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { listCourts, type Court } from '../../lib/api/courts'
import {
  createTournament,
  patchTournament,
  patchTournamentCategories,
  patchTournamentRankingRules,
  type BracketFormat,
  type CategoryGenderScope,
  type CategoryModality,
  type RankingPlacement,
  type TournamentSport,
  type TournamentType,
} from '../../lib/api/tournaments'
import { SPORTS } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import './TournamentFormPage.css'

/** Formato de chaveamento default do torneio — obrigatório pelo backend
 * (CreateRequest.BracketFormat), sem campo próprio no wizard (AC de
 * BEAC-1985 não lista "formato de chaveamento" entre os campos dos 4
 * steps). Editável depois via PATCH /tournaments/{id} por uma tela futura
 * (fora do escopo desta story) — não fabricado, só um default sensato. */
const DEFAULT_BRACKET_FORMAT: BracketFormat = 'single_elimination'

const STEP_LABELS: { step: number; label: string }[] = [
  { step: 1, label: 'Dados' },
  { step: 2, label: 'Categorias' },
  { step: 3, label: 'Inscrições' },
  { step: 4, label: 'Pontuação' },
]

const TYPE_PILLS: { type: TournamentType; label: string }[] = [
  { type: 'fechado', label: 'Fechado' },
  { type: 'aberto', label: 'Aberto' },
  { type: 'inter_arenas', label: 'Inter-arenas' },
  { type: 'externo', label: 'Externo' },
]

const GENDER_SCOPE_OPTIONS: { value: CategoryGenderScope; label: string }[] = [
  { value: 'masculino', label: 'Masculina' },
  { value: 'feminino', label: 'Feminina' },
  { value: 'misto', label: 'Mista' },
  { value: 'livre', label: 'Livre' },
]

const MODALITY_OPTIONS: { value: CategoryModality; label: string }[] = [
  { value: 'duplas', label: 'Duplas' },
  { value: 'individual', label: 'Individual' },
]

/** Rótulos PT-BR das 6 colocações — mesmo catálogo fechado semeado pelo
 * backend na criação (rankingPlacementDefaults, tournaments/shared.go). */
const RANKING_LABELS: Record<RankingPlacement, string> = {
  campeao: 'Campeão',
  vice: 'Vice',
  terceiro: '3º lugar',
  semifinalista: 'Semifinal',
  quartas: 'Quartas',
  participacao: 'Participação',
}

/** Ordem/valores default (100/70/50/35/20/10) — mesmos de
 * rankingPlacementDefaults, usados pra hidratar o Step 4 ANTES do primeiro
 * "Salvar rascunho" (quando o torneio ainda não existe no backend e não há
 * o que buscar). */
const DEFAULT_RANKING_RULES: { placement: RankingPlacement; points: number }[] = [
  { placement: 'campeao', points: 100 },
  { placement: 'vice', points: 70 },
  { placement: 'terceiro', points: 50 },
  { placement: 'semifinalista', points: 35 },
  { placement: 'quartas', points: 20 },
  { placement: 'participacao', points: 10 },
]

interface CategoryFormState {
  id?: string
  name: string
  genderScope: CategoryGenderScope
  modality: CategoryModality
  maxParticipants: number
}

function newCategory(): CategoryFormState {
  return { name: '', genderScope: 'livre', modality: 'duplas', maxParticipants: 16 }
}

/** Converte um <input type="date"> (AAAA-MM-DD) num timestamp RFC3339 —
 * formato exigido por registration_opens_at/closes_at (ver
 * parseOptionalTimestamp, tournaments/create.go). "Abrem" à meia-noite,
 * "Encerram" ao fim do dia, fuso -03:00 (mesmo padrão de horário usado em
 * toda a cópia PT-BR do app). String vazia (campo não preenchido) vira
 * null — nenhum dos dois é obrigatório no backend. */
function toRegistrationOpensAt(date: string): string | null {
  return date ? `${date}T00:00:00-03:00` : null
}
function toRegistrationClosesAt(date: string): string | null {
  return date ? `${date}T23:59:59-03:00` : null
}

/**
 * TO2 — Criar Torneio (BEAC-1985, story BEAC-1716). Wizard de 4 steps lido
 * diretamente do protótipo real (`scr-to2`): Dados/Categorias/Inscrições/
 * Pontuação, navegação Anterior/Próximo, "Salvar rascunho" disponível em
 * qualquer step (pg-head, sempre visível).
 *
 * ## Navegação de step é 100% local; só "Salvar rascunho" fala com a API
 *
 * O protótipo real não define nenhum comportamento de persistência para
 * Anterior/Próximo (é um mockup estático, troca de `display` via JS) — a
 * única cópia que menciona salvar é o botão dedicado "Salvar rascunho". Por
 * isso: trocar de step nunca dispara rede; handleSaveDraft (chamado pelo
 * único botão de salvar) é quem persiste TUDO que já foi preenchido em
 * qualquer step, na ordem create/patch (dados básicos) -> patch categories
 * -> patch ranking-rules, criando o torneio no primeiro save e reusando o
 * id nos seguintes.
 *
 * ## Sem lista de categorias/quadras pré-populada
 *
 * O `scr-to2` mostra 3 categorias de exemplo e quadras "Q1, Q2, Q4" — são
 * conteúdo ilustrativo do mockup, não um estado inicial real: um torneio
 * novo começa sem categorias (usuário adiciona via "+ Adicionar
 * categoria") e sem quadra selecionada.
 *
 * ## Remover categoria já salva não chama DELETE (endpoint não existe)
 *
 * Ver comentário de pacote de src/lib/api/tournaments.ts
 * (patchTournamentCategories) — mesmo gap, documentado lá.
 */
export default function TournamentFormPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [courts, setCourts] = useState<Court[]>([])

  // Step 1 — Dados
  const [name, setName] = useState('')
  const [sport, setSport] = useState<TournamentSport>(SPORTS[0].slug as TournamentSport)
  const [courtIds, setCourtIds] = useState<string[]>([])
  const [type, setType] = useState<TournamentType>('fechado')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Step 2 — Categorias
  const [categories, setCategories] = useState<CategoryFormState[]>([])

  // Step 3 — Inscrições
  const [entryFee, setEntryFee] = useState<number | ''>('')
  const [registrationOpensDate, setRegistrationOpensDate] = useState('')
  const [registrationClosesDate, setRegistrationClosesDate] = useState('')
  const [requiresPayment, setRequiresPayment] = useState(true)

  // Step 4 — Pontuação
  const [rankingRules, setRankingRules] =
    useState<{ placement: RankingPlacement; points: number }[]>(DEFAULT_RANKING_RULES)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!unitId) return
    listCourts(unitId).then((result) => {
      if (result.ok) setCourts(result.courts)
    })
  }, [unitId])

  function toggleCourt(courtId: string) {
    setCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId],
    )
  }

  function addCategory() {
    setCategories((prev) => [...prev, newCategory()])
  }

  function removeCategory(index: number) {
    const category = categories[index]
    // GAP CONHECIDO: não existe endpoint de DELETE pra tournament_categories
    // (ver comentário em tournaments.ts) — remover aqui só tira a categoria
    // da tela, ela continua existindo e sendo inscrevível no backend se já
    // tiver sido salva antes. Avisar explicitamente nesse caso, já que
    // esconder isso silenciosamente pode confundir o organizador (achado na
    // review de BEAC-1985).
    if (category?.id) {
      const confirmed = window.confirm(
        'Esta categoria já foi salva — removê-la aqui só a esconde deste formulário. ' +
          'Inscrições e o link de inscrição dela continuam válidos no sistema. Remover mesmo assim?',
      )
      if (!confirmed) return
    }
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCategory(index: number, patch: Partial<CategoryFormState>) {
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function updateRankingPoints(placement: RankingPlacement, points: number) {
    setRankingRules((prev) => prev.map((r) => (r.placement === placement ? { ...r, points } : r)))
  }

  async function handleSaveDraft() {
    if (!unitId) return
    setSaveError(null)
    setSavedMessage(null)
    setSaving(true)
    try {
      const basicFields = {
        name,
        sport,
        type,
        startDate,
        endDate,
        courtIds,
        entryFee: entryFee === '' ? 0 : entryFee,
        registrationOpensAt: toRegistrationOpensAt(registrationOpensDate),
        registrationClosesAt: toRegistrationClosesAt(registrationClosesDate),
        requiresPayment,
      }

      let id = tournamentId
      if (!id) {
        const result = await createTournament(unitId, {
          ...basicFields,
          bracketFormat: DEFAULT_BRACKET_FORMAT,
          // Step 4 (Pontuação) está sempre presente e sempre preenchido no
          // wizard — a intenção é que todo torneio criado por aqui alimente
          // os rankings (Eixo 4), então o default é `true`, não o zero-value
          // `false` do Go. Achado na review de BEAC-1985.
          useRankingPoints: true,
        })
        if (!result.ok) {
          setSaveError(result.message ?? 'Não foi possível salvar o rascunho.')
          return
        }
        id = result.tournament.id
        setTournamentId(id)
      } else {
        const result = await patchTournament(id, basicFields)
        if (!result.ok) {
          setSaveError(result.message ?? 'Não foi possível salvar o rascunho.')
          return
        }
      }

      if (categories.length > 0) {
        const catResult = await patchTournamentCategories(
          id,
          categories.map((c) => ({
            id: c.id,
            name: c.name,
            genderScope: c.genderScope,
            modality: c.modality,
            maxParticipants: c.maxParticipants,
          })),
        )
        if (!catResult.ok) {
          setSaveError(catResult.message ?? 'Não foi possível salvar as categorias.')
          return
        }
        setCategories(
          catResult.categories.map((c) => ({
            id: c.id,
            name: c.name,
            genderScope: c.genderScope,
            modality: c.modality,
            maxParticipants: c.maxParticipants,
          })),
        )
      }

      const rankResult = await patchTournamentRankingRules(
        id,
        rankingRules.map((r) => ({ placement: r.placement, points: r.points })),
      )
      if (!rankResult.ok) {
        setSaveError(rankResult.message ?? 'Não foi possível salvar a pontuação.')
        return
      }
      setRankingRules(rankResult.rankingRules.map((r) => ({ placement: r.placement, points: r.points })))

      setSavedMessage('Rascunho salvo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <button
          type="button"
          className="back"
          onClick={() => unitId && navigate(`/units/${unitId}/tournaments`)}
        >
          ‹ Torneios
        </button>
        <h1>Criar torneio</h1>
        <div className="spacer" />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleSaveDraft}
          disabled={saving}
        >
          {saving ? 'Salvando…' : 'Salvar rascunho'}
        </button>
      </div>

      <div className="dash-body to2-body">
        <div className="steps" role="tablist" aria-label="Etapas de criação do torneio">
          {STEP_LABELS.map(({ step: s, label }, idx) => (
            <span className="step-wrap" key={s}>
              <span
                className={`st${step === s ? ' on' : ''}`}
                role="tab"
                aria-selected={step === s}
              >
                <span className="b">{s}</span>
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 ? <span className="sep" /> : null}
            </span>
          ))}
        </div>

        {saveError ? <p role="alert">{saveError}</p> : null}
        {savedMessage ? <p role="status">{savedMessage}</p> : null}

        {step === 1 ? (
          <div className="stack">
            <label className="field">
              <span>Nome</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className="form-row">
              <label className="field">
                <span>Esporte</span>
                <select value={sport} onChange={(e) => setSport(e.target.value as TournamentSport)}>
                  {SPORTS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span>Quadras</span>
                <div className="court-checks">
                  {courts.length === 0 ? <p className="hint">Nenhuma quadra cadastrada.</p> : null}
                  {courts.map((court) => (
                    <label className="check-row" key={court.id}>
                      <input
                        type="checkbox"
                        checked={courtIds.includes(court.id)}
                        onChange={() => toggleCourt(court.id)}
                      />
                      {court.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <span>Tipo</span>
              <div className="tabs2" role="group" aria-label="Tipo de torneio">
                {TYPE_PILLS.map((pill) => (
                  <button
                    key={pill.type}
                    type="button"
                    className={type === pill.type ? 'active' : ''}
                    aria-pressed={type === pill.type}
                    onClick={() => setType(pill.type)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
              <p className="hint">
                Aberto/externo geram link público — visitantes acompanham sem conta.
              </p>
            </div>

            <div className="form-row">
              <label className="field">
                <span>Início</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Fim</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stack">
            {categories.length === 0 ? <p className="hint">Nenhuma categoria adicionada.</p> : null}
            {categories.map((category, index) => (
              <div className="cat-row cat-row-edit" key={category.id ?? `new-${index}`}>
                <input
                  type="text"
                  aria-label={`Nome da categoria ${index + 1}`}
                  placeholder="Nome da categoria"
                  value={category.name}
                  onChange={(e) => updateCategory(index, { name: e.target.value })}
                />
                <select
                  aria-label={`Gênero da categoria ${index + 1}`}
                  value={category.genderScope}
                  onChange={(e) =>
                    updateCategory(index, { genderScope: e.target.value as CategoryGenderScope })
                  }
                >
                  {GENDER_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Modalidade da categoria ${index + 1}`}
                  value={category.modality}
                  onChange={(e) =>
                    updateCategory(index, { modality: e.target.value as CategoryModality })
                  }
                >
                  {MODALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  aria-label={`Limite de participantes da categoria ${index + 1}`}
                  value={category.maxParticipants}
                  onChange={(e) => updateCategory(index, { maxParticipants: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="cat-remove"
                  aria-label={`Remover categoria ${index + 1}`}
                  onClick={() => removeCategory(index)}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addCategory}>
              + Adicionar categoria
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="stack">
            <label className="field">
              <span>Taxa por dupla</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>

            <div className="form-row">
              <label className="field">
                <span>Abrem</span>
                <input
                  type="date"
                  value={registrationOpensDate}
                  onChange={(e) => setRegistrationOpensDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Encerram</span>
                <input
                  type="date"
                  value={registrationClosesDate}
                  onChange={(e) => setRegistrationClosesDate(e.target.value)}
                />
              </label>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={requiresPayment}
                onChange={(e) => setRequiresPayment(e.target.checked)}
              />
              Inscrição confirma só após pagamento (timeout 24h libera a vaga)
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="stack">
            {rankingRules.map((rule) => (
              <div className="cat-row" key={rule.placement}>
                <span className="cn">{RANKING_LABELS[rule.placement]}</span>
                <input
                  type="number"
                  min={0}
                  aria-label={`Pontos — ${RANKING_LABELS[rule.placement]}`}
                  value={rule.points}
                  onChange={(e) => updateRankingPoints(rule.placement, Number(e.target.value))}
                />
              </div>
            ))}
            <p className="hint">
              Pontuação alimenta os rankings (arena → cidade → estado → nacional). Editável por
              torneio.
            </p>
          </div>
        ) : null}

        <div className="row nav-row">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            disabled={step === 4}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
          >
            Próximo
          </button>
        </div>

        <p className="hint-note">
          Torneio nasce como rascunho; publicar abre as inscrições. Categorias editáveis até gerar o
          chaveamento.
        </p>
      </div>
    </AppShell>
  )
}
