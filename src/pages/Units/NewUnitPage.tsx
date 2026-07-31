import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Chip } from '../../components/ui/Chip/Chip'
import { Icon } from '../../components/ui/Icon/Icon'
import { Input } from '../../components/ui/Input/Input'
import { Select } from '../../components/ui/Select/Select'
import { StepIndicator } from '../../components/ui/StepIndicator/StepIndicator'
import { createUnit } from '../../lib/api/units'
import { SPORTS, sportCssVar } from '../../lib/sports'
import { appendCreatedUnit } from '../../lib/unitsLocalStore'
import './NewUnitPage.css'

const TIMEZONES = ['America/Sao_Paulo', 'America/Recife', 'America/Manaus']

type Step = 1 | 2 | 'success'

/**
 * OW3 — Nova unidade (BEAC-1831/1832). Reskin a partir do Figma "Rallye —
 * Protótipo" (frames "12/13 · Criar Arena — Passo 1/2", canvases Auth —
 * Mobile/Desktop): o protótipo divide a criação de arena num wizard de 2
 * passos com `AuthLayout` (Brand Panel + Form Panel) e `StepIndicator` —
 * mesmo padrão visual de Login/Cadastro/S1, embora esta tela seja alcançada
 * de dentro do dashboard (botão "+ Nova unidade" em OW2/UnitsPage), não do
 * fluxo de onboarding. Decisão de mapeamento: seguido o Figma à risca (fonte
 * de verdade) em vez de manter o AppShell anterior — ver resumo da tarefa
 * para o trade-off.
 *
 * Os CAMPOS coletados (Nome, Endereço, Telefone, Fuso horário, Esportes,
 * Horário de funcionamento) são os mesmos do formulário único anterior — a
 * lógica de negócio (validação, `createUnit`, `appendCreatedUnit`,
 * navegação) foi 100% preservada. O Figma mostra campos diferentes por
 * passo (Cidade/Bairro em vez de Telefone/Fuso; "Quantas quadras" em vez de
 * Horário de funcionamento) que não existem no schema de `public.units`
 * consumido por esta tela — os campos reais foram encaixados na MESMA
 * estrutura visual (passo 1: nome + par de campos lado a lado + campo
 * único; passo 2: chips de esporte + campo único) em vez de inventar
 * colunas novas. `operating_hours` continua `{ summary: "<texto>" }` (ver
 * decisão original da migration 000005).
 */
export default function NewUnitPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [sports, setSports] = useState<string[]>([])
  const [operatingHours, setOperatingHours] = useState('Seg–Dom · 06:00–22:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSport(slug: string) {
    setSports((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function handleContinue(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }
    setError(null)
    setStep(2)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!tenantId) return

    setSubmitting(true)
    setError(null)
    const result = await createUnit(tenantId, {
      name,
      address,
      phone,
      timezone,
      sportsOffered: sports,
      operatingHours: { summary: operatingHours },
    })
    setSubmitting(false)

    if (!result.ok) {
      setError(
        result.status === 403
          ? 'Só o dono do tenant pode criar unidades.'
          : `Não foi possível criar a unidade (${result.error}).`,
      )
      return
    }

    appendCreatedUnit(tenantId, { id: result.id, name })
    setStep('success')
  }

  const stepLabel = step === 1 ? 'Passo 1 de 2' : 'Passo 2 de 2'

  if (step === 'success') {
    return (
      <section aria-labelledby="new-unit-title">
        <AuthLayout
          heroTitle="Você tá dentro!"
          heroSubtitle="Sua arena já faz parte do Rallye."
        >
          <div className="unit-success">
            <div className="unit-success__badge">
              <div className="unit-success__badge-inner">
                <Icon name="check" size={28} className="unit-success__icon" />
              </div>
            </div>
            <h1 id="new-unit-title" className="unit-success__title">
              Arena criada!
            </h1>
            <p className="unit-success__subtitle">
              Sua arena já está no Rallye. Complete os dados de repasse e quadras no painel quando puder.
            </p>
            <Button fullWidth size="lg" onClick={() => navigate('/dashboard')}>
              Ir para o painel
            </Button>
          </div>
        </AuthLayout>
      </section>
    )
  }

  return (
    <section aria-labelledby="new-unit-title">
      <AuthLayout
        onBack={step === 1 ? () => navigate(`/tenants/${tenantId}/units`) : () => setStep(1)}
        heroTitle="Cadastre sua arena"
        heroSubtitle={
          step === 1
            ? 'Coloque sua arena no Rallye em poucos passos.'
            : 'Últimos detalhes antes de liberar seu painel.'
        }
        title={
          <span id="new-unit-title">{step === 1 ? 'Cadastrar minha arena' : 'O que rola na sua arena?'}</span>
        }
        subtitle={
          step === 1
            ? 'Vamos criar o perfil da sua arena no Rallye. Você pode completar os detalhes depois.'
            : 'Escolha os esportes que sua arena oferece — dá pra mudar isso depois.'
        }
        hint={step === 2 ? 'Dados de repasse de pagamento e quadras detalhadas você completa depois, no painel da arena.' : undefined}
      >
        <StepIndicator total={2} current={step} label={stepLabel} />

        {step === 1 ? (
          <form className="stack new-unit-form" onSubmit={handleContinue} noValidate>
            <Input
              id="unit-name"
              label="Nome da arena"
              placeholder="Ex.: Arena Beira-Mar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="two-col">
              <Input
                id="unit-phone"
                label="Telefone"
                placeholder="(48) ..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Select
                id="unit-timezone"
                label="Fuso horário"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                options={TIMEZONES}
              />
            </div>
            <Input
              id="unit-address"
              label="Endereço"
              placeholder="Rua, número, bairro, cidade — UF"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {error ? (
              <AlertCard tone="danger">
                <p role="alert">{error}</p>
              </AlertCard>
            ) : null}
            <Button type="submit" fullWidth>
              Continuar
            </Button>
          </form>
        ) : (
          <form className="stack new-unit-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Esportes oferecidos</label>
              <div className="chip-group">
                {SPORTS.map((sport) => (
                  <Chip
                    key={sport.slug}
                    label={sport.label}
                    selected={sports.includes(sport.slug)}
                    onToggle={() => toggleSport(sport.slug)}
                    dot
                    dotColor={`var(${sportCssVar(sport.slug)})`}
                  />
                ))}
              </div>
            </div>
            <Input
              id="unit-hours"
              label="Horário de funcionamento"
              value={operatingHours}
              onChange={(e) => setOperatingHours(e.target.value)}
            />
            {error ? (
              <AlertCard tone="danger">
                <p role="alert">{error}</p>
              </AlertCard>
            ) : null}
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'Criando…' : 'Criar minha arena'}
            </Button>
          </form>
        )}
      </AuthLayout>
    </section>
  )
}
