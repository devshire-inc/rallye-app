import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button/Button'
import { Checkbox } from '../../components/ui/Checkbox/Checkbox'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Input } from '../../components/ui/Input/Input'
import { Segmented } from '../../components/ui/Segmented/Segmented'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import {
  createPlan,
  getPlanForEdit,
  patchPlan,
  type BillingCycle,
  type PlanType,
  type PlanVariant,
} from '../../lib/api/plans'
import '../../components/AuthLayout/AuthLayout.css'
import './PlanoFormPage.css'

/** Rótulo/desconto default de cada recorrência (PL2 doc, tabela "Planos e
 * Variantes de Recorrência" — desconto progressivo padrão que o admin pode
 * customizar por variante, regra 2: "Admin pode customizar o desconto de
 * cada variante"). */
const CYCLE_DEFAULTS: { cycle: BillingCycle; label: string; discountPercent: number }[] = [
  { cycle: 'mensal', label: 'Mensal', discountPercent: 0 },
  { cycle: 'bimestral', label: 'Bimestral', discountPercent: 5 },
  { cycle: 'trimestral', label: 'Trimestral', discountPercent: 10 },
  { cycle: 'semestral', label: 'Semestral', discountPercent: 15 },
  { cycle: 'anual', label: 'Anual', discountPercent: 20 },
]

const TYPE_PILLS: { type: PlanType; label: string }[] = [
  { type: 'mensalidade', label: 'Mensalidade' },
  { type: 'pacote', label: 'Pacote' },
  { type: 'day_use', label: 'Day use' },
]

interface VariantFormState {
  id?: string
  billingCycle: BillingCycle
  discountPercent: number
  isActive: boolean
}

function defaultVariantsFor(type: PlanType): VariantFormState[] {
  if (type !== 'mensalidade') {
    return [{ billingCycle: 'mensal', discountPercent: 0, isActive: true }]
  }
  return CYCLE_DEFAULTS.map((c) => ({
    billingCycle: c.cycle,
    discountPercent: c.discountPercent,
    isActive: true,
  }))
}

function variantsFromExisting(variants: PlanVariant[]): VariantFormState[] {
  return variants.map((v) => ({
    id: v.id,
    billingCycle: v.billingCycle,
    discountPercent: v.discountPercent,
    isActive: v.isActive,
  }))
}

function computeFinalPrice(basePrice: number, discountPercent: number): number {
  return Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function cycleLabel(cycle: BillingCycle): string {
  return CYCLE_DEFAULTS.find((c) => c.cycle === cycle)?.label ?? cycle
}

type LoadState = 'idle' | 'loading' | 'error' | 'ready'

/** PL2 — Criar/Editar Plano (BEAC-1935, story BEAC-1927 — "Planos e
 * Assinaturas"). Campos e layout lidos diretamente da doc real do
 * protótipo (Allye docs, "Financeiro" > "PL2 — Criar/Editar Plano"): Nome,
 * Tipo (pills), Esporte, Sessões/semana (mensalidade)/Total sessões
 * (pacote), Máx. membros, Preço base + lista de variantes com checkbox
 * ativar/desativar e preço/desconto calculados.
 *
 * ## "Sessões por semana"/"Preço base" são campos do FORM, não do banco
 *
 * O AC de BEAC-1929 (migration, já travada) modela sessions_per_week e
 * base_price em `plan_variants`, não em `plans` — mas a doc PL2 os trata
 * como um único valor por PLANO (ex.: "3x por semana" é uma frequência que
 * não muda entre a variante mensal e a anual do MESMO plano). Esta tela
 * pede o valor uma vez e propaga pra TODAS as variantes ao salvar — mesmo
 * espírito de "Admin define o preço base (mensal) e os descontos por
 * período são calculados automaticamente" (regra 1 da doc).
 *
 * ## Modo edição: getPlanForEdit
 *
 * Hidrata o form via getPlanForEdit — GET /plans/{id} dedicado desde
 * BEAC-1976 (antes, reaproveitava PATCH /plans/{id} com corpo vazio; ver
 * comentário de pacote em lib/api/plans.ts pro histórico e pro porquê do
 * nome ter ficado o mesmo apesar da troca de endpoint por baixo).
 */
export default function PlanoFormPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, planId } = useParams<{ unitId: string; planId?: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(planId)

  const [name, setName] = useState('')
  const [type, setType] = useState<PlanType>('mensalidade')
  const [sport, setSport] = useState('')
  const [maxMembers, setMaxMembers] = useState(1)
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number | ''>('')
  const [totalSessions, setTotalSessions] = useState<number | ''>('')
  const [basePrice, setBasePrice] = useState<number | ''>('')
  const [variants, setVariants] = useState<VariantFormState[]>(defaultVariantsFor('mensalidade'))
  const [loadState, setLoadState] = useState<LoadState>(isEdit ? 'loading' : 'idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!planId) return
      getPlanForEdit(planId).then((result) => {
        if (onCancelled()) return
        if (!result.ok) {
          setLoadState('error')
          return
        }
        const p = result.plan
        setName(p.name)
        setType(p.type)
        setSport(p.sport ?? '')
        setMaxMembers(p.maxMembers)
        setSessionsPerWeek(p.variants[0]?.sessionsPerWeek ?? '')
        setTotalSessions(p.variants[0]?.totalSessions ?? '')
        setBasePrice(p.variants[0]?.basePrice ?? '')
        setVariants(
          p.variants.length > 0 ? variantsFromExisting(p.variants) : defaultVariantsFor(p.type),
        )
        setLoadState('ready')
      })
    },
    [planId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  function handleTypeChange(nextType: PlanType) {
    setType(nextType)
    if (!isEdit) {
      setVariants(defaultVariantsFor(nextType))
    }
  }

  function updateVariant(index: number, patch: Partial<VariantFormState>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    if (!unitId) return
    const price = typeof basePrice === 'number' ? basePrice : 0

    const variantPayloads = variants.map((v) => ({
      id: v.id,
      billingCycle: v.billingCycle,
      basePrice: price,
      discountPercent: v.discountPercent,
      sessionsPerWeek:
        type === 'mensalidade' ? (sessionsPerWeek === '' ? null : sessionsPerWeek) : null,
      totalSessions: type === 'pacote' ? (totalSessions === '' ? null : totalSessions) : null,
      isActive: v.isActive,
    }))

    setSaving(true)
    const result =
      isEdit && planId
        ? await patchPlan(planId, {
            name,
            type,
            sport: sport || undefined,
            maxMembers,
            variants: variantPayloads,
          })
        : await createPlan(unitId, {
            name,
            type,
            sport: sport || undefined,
            maxMembers,
            variants: variantPayloads,
          })
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.message ?? 'Não foi possível salvar o plano.')
      return
    }
    navigate(`/units/${unitId}/plans`)
  }

  if (loadState === 'loading') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <p role="status">Carregando plano…</p>
      </AppShell>
    )
  }
  if (loadState === 'error') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <p role="alert">Não foi possível carregar este plano.</p>
      </AppShell>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <form className="plano-form" onSubmit={handleSubmit}>
        <div className="pg-head">
          <IconButton
            variant="ghost"
            size="sm"
            label="Voltar"
            onClick={() => unitId && navigate(`/units/${unitId}/plans`)}
          >
            ←
          </IconButton>
          <h1>{isEdit ? 'Editar plano' : 'Novo plano'}</h1>
        </div>

        <div className="form-body">
          <Input
            label="Nome"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: 3x por semana - Beach Tennis"
            required
          />

          <div className="field">
            <span>Tipo</span>
            <Segmented
              ariaLabel="Tipo de plano"
              options={TYPE_PILLS.map((pill) => pill.label)}
              value={TYPE_PILLS.find((pill) => pill.type === type)?.label}
              onChange={(label) => {
                const pill = TYPE_PILLS.find((p) => p.label === label)
                if (pill) handleTypeChange(pill.type)
              }}
            />
          </div>

          <Input
            label="Esporte"
            type="text"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            placeholder="Ex.: beach_tennis"
          />

          {type === 'mensalidade' ? (
            <Input
              label="Sessões por semana"
              type="number"
              min={0}
              value={sessionsPerWeek}
              onChange={(e) =>
                setSessionsPerWeek(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="Deixe em branco para ilimitado"
            />
          ) : null}

          {type === 'pacote' ? (
            <Input
              label="Total de sessões"
              type="number"
              min={0}
              value={totalSessions}
              onChange={(e) =>
                setTotalSessions(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          ) : null}

          <Input
            label="Máx. membros"
            type="number"
            min={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
          />

          <Input
            label="Preço base"
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />

          {type === 'mensalidade' ? (
            <div className="variants-section">
              <span className="variants-title">Variantes de recorrência</span>
              {variants.map((v, index) => {
                const price = typeof basePrice === 'number' ? basePrice : 0
                const finalPrice = computeFinalPrice(price, v.discountPercent)
                return (
                  <div className="variant-row" key={v.billingCycle}>
                    <label className="variant-checkbox">
                      <Checkbox
                        ariaLabel={`Ativar ${cycleLabel(v.billingCycle)}`}
                        checked={v.isActive}
                        onChange={(checked) => updateVariant(index, { isActive: checked })}
                      />
                      {cycleLabel(v.billingCycle)}
                    </label>
                    <span className="variant-price">
                      {`R$ ${formatPrice(finalPrice)}/mês${v.discountPercent > 0 ? ` · −${v.discountPercent}%` : ''}`}
                    </span>
                    <label className="variant-discount">
                      <span>Desconto %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={v.discountPercent}
                        onChange={(e) =>
                          updateVariant(index, { discountPercent: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          ) : null}

          {saveError ? <p role="alert">{saveError}</p> : null}

          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar plano'}
          </Button>

          <p className="hint-note">Editar não afeta assinaturas existentes — só novas.</p>
        </div>
      </form>
    </AppShell>
  )
}
