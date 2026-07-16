import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { createUnit } from '../../lib/api/units'
import { appendCreatedUnit } from '../../lib/unitsLocalStore'
import '../../components/AuthLayout/AuthLayout.css'
import './UnitsPage.css'
import './NewUnitPage.css'

interface Sport {
  slug: string
  label: string
}

const SPORTS: Sport[] = [
  { slug: 'beach_tennis', label: 'Beach tennis' },
  { slug: 'padel', label: 'Padel' },
  { slug: 'futevolei', label: 'Futevôlei' },
  { slug: 'volei', label: 'Vôlei' },
]

const TIMEZONES = ['America/Sao_Paulo', 'America/Recife', 'America/Manaus']

/**
 * OW3 — Nova unidade (BEAC-1831/1832). Markup e campos seguem scr-ow3 do
 * protótipo real e o schema de public.units (BEAC-1824): Nome, Endereço
 * completo, Telefone, Fuso horário, Esportes oferecidos (multi-seleção),
 * Horário de funcionamento.
 *
 * `operating_hours` é JSONB de estrutura livre (comentário da migration
 * 000005: "estrutura definida pela UI do OW3") — como nenhuma outra task
 * definiu isso, esta é a decisão de UI: `{ "summary": "<texto>" }`, o mesmo
 * texto livre que o protótipo já usa num único campo (não um editor de
 * grade horária por dia).
 *
 * CTA "Criar unidade → cadastrar quadras" chama o POST real
 * (BEAC-1831) e, no sucesso, navega para o stub de C2 (cadastro de quadras,
 * fora deste épico) — /dashboard, mesmo placeholder genérico já usado nesta
 * app para telas de outros épicos. A unit criada é persistida em
 * unitsLocalStore ANTES dessa navegação, para que voltar em OW2 já mostre a
 * nova unit (ver gap de listagem documentado em unitsLocalStore.ts).
 */
export default function NewUnitPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!tenantId) return
    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }

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
    navigate('/dashboard')
  }

  return (
    <AppShell orgLabel="Rede Areia Dourada" userLabel="Dono">
      <div className="pg-head">
        <Link className="back" to={`/tenants/${tenantId}/units`}>
          ‹ Unidades
        </Link>
        <h1>Nova unidade</h1>
        <div className="spacer" />
      </div>
      <form className="dash-body new-unit-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="unit-name">Nome</label>
          <input
            id="unit-name"
            className="input"
            placeholder="Areia Dourada · Campeche"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="unit-address">Endereço completo</label>
          <input
            id="unit-address"
            className="input"
            placeholder="Rua, número, bairro, cidade — UF"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="two-col">
          <div className="field">
            <label htmlFor="unit-phone">Telefone</label>
            <input
              id="unit-phone"
              className="input"
              placeholder="(48) ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="unit-timezone">Fuso horário</label>
            <select
              id="unit-timezone"
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Esportes oferecidos</label>
          <div className="tabs2">
            {SPORTS.map((sport) => (
              <button
                key={sport.slug}
                type="button"
                className={sports.includes(sport.slug) ? 'active' : ''}
                onClick={() => toggleSport(sport.slug)}
              >
                {sport.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="unit-hours">Horário de funcionamento</label>
          <input
            id="unit-hours"
            className="input"
            value={operatingHours}
            onChange={(e) => setOperatingHours(e.target.value)}
          />
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        <button className="btn btn-primary btn-md" type="submit" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar unidade → cadastrar quadras'}
        </button>
      </form>
    </AppShell>
  )
}
