import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { AvailabilityGrid } from '../../components/AvailabilityGrid/AvailabilityGrid'
import { Checkbox } from '../../components/ui/Checkbox/Checkbox'
import { usePermission } from '../../hooks/usePermission'
import {
  AVAILABILITY_TIME_SLOTS,
  getAvailability,
  patchAvailability,
  type AvailabilitySlot,
  type AvailabilityTimeSlot,
  type DayOfWeek,
} from '../../lib/api/availability'
import { patchRemuneration } from '../../lib/api/remuneration'
import {
  createTeacher,
  getTeacher,
  patchTeacher,
  type CreateTeacherAccountExists,
  type CreateTeacherResult,
  type RemunerationModel,
} from '../../lib/api/teachers'
import { SPORTS } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import '../Units/NewUnitPage.css'
import '../Students/NewStudentPage.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TeacherFormPage.css'

const MODEL_OPTIONS: { value: RemunerationModel; label: string; unitLabel: string }[] = [
  { value: 'fixed', label: 'Fixo mensal', unitLabel: '/mês' },
  { value: 'per_class', label: 'Por aula', unitLabel: '/aula' },
  { value: 'commission', label: 'Comissão', unitLabel: '% da receita' },
]

/** Dias exibidos na grade — mesmo recorte (Seg-Sáb) de AvailabilityGrid. */
const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6]
const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

// Separador "|" (não "-"): timeSlot já contém "-" (ex. "08-10"), então um
// separador "-" quebraria o split reverso em submitCreate (achado por teste).
function slotKey(dayOfWeek: DayOfWeek, timeSlot: AvailabilityTimeSlot): string {
  return `${dayOfWeek}|${timeSlot}`
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'not-found' } | { status: 'ready' }

/**
 * PR3 — Cadastro/Edição de Professor (BEAC-1875, story BEAC-1696). Mesma
 * tela para os dois modos (AC): `/units/:unitId/teachers/new` (criar) e
 * `/units/:unitId/teachers/:teacherId/edit` (editar) — `isEdit` é derivado
 * da presença de `teacherId` no path, não de uma prop separada.
 *
 * Campos/layout lidos diretamente do doc real (PR3 — "Cadastro/Edição de
 * Professor", tabela "Campos" + ASCII "Modelo de Remuneração"): todos
 * obrigatórios exceto Certificações/Bio, remuneração como 3 radios com
 * input condicional (Fixo mensal/Por aula em R$, Comissão em %).
 *
 * ## Disponibilidade — decisão de wiring desta task
 *
 * AvailabilityGrid mode="edit" persiste CADA clique imediatamente via PATCH
 * /teachers/{id}/availability (ver comentário de pacote do componente) —
 * pressupõe um teacherId que já existe. Em modo CRIAR não há teacherId até o
 * POST suceder, então esta tela usa uma grade local própria (só estado, sem
 * chamada de rede por clique) durante o cadastro; ao criar com sucesso, as
 * faixas marcadas são enviadas de uma vez via patchAvailability (batch) —
 * best-effort: se essa chamada falhar, o professor já foi criado mesmo assim
 * (a disponibilidade fica zerada, editável depois por PR2/aba Horários ou
 * reabrindo esta tela em modo editar). Em modo EDITAR, o teacherId já existe
 * — usa o AvailabilityGrid real (mode="edit"), mesmo componente/persistência
 * imediata da aba Horários de PR2.
 *
 * ## E-mail
 *
 * Só editável em modo criar — em modo editar é somente-leitura (o PATCH
 * /teachers/{id} não aceita/persiste email, ver comentário de pacote do
 * handler real).
 *
 * Permissão: `professores:write` controla a tela inteira — "esconder
 * sempre, nunca desabilitar" (mesmo padrão de NewStudentPage).
 */
export default function TeacherFormPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, teacherId } = useParams<{ unitId: string; teacherId?: string }>()
  const navigate = useNavigate()
  const canWrite = usePermission('professores', 'write')
  const isEdit = Boolean(teacherId)

  const [loadState, setLoadState] = useState<LoadState>(isEdit ? { status: 'loading' } : { status: 'ready' })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sports, setSports] = useState<string[]>([])
  const [remunerationModel, setRemunerationModel] = useState<RemunerationModel>('fixed')
  const [remunerationValue, setRemunerationValue] = useState('')
  const [certifications, setCertifications] = useState('')
  const [bio, setBio] = useState('')
  const [inviteEmail, setInviteEmail] = useState(true)
  const [inviteWhatsapp, setInviteWhatsapp] = useState(false)

  // Modo criar: grade local (sem persistência por clique, ver comentário de
  // módulo). Modo editar: slots reais carregados de GET
  // /teachers/{id}/availability, passados ao AvailabilityGrid real.
  const [localAvailability, setLocalAvailability] = useState<Map<string, boolean>>(new Map())
  const [existingAvailability, setExistingAvailability] = useState<AvailabilitySlot[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState<CreateTeacherAccountExists | null>(null)

  useEffect(() => {
    if (!isEdit || !teacherId) return
    let cancelled = false

    Promise.all([getTeacher(teacherId), getAvailability(teacherId)]).then(
      ([teacherResult, availabilityResult]) => {
        if (cancelled) return
        if (!teacherResult.ok) {
          setLoadState(teacherResult.status === 404 ? { status: 'not-found' } : { status: 'error' })
          return
        }
        const teacher = teacherResult.teacher
        setFullName(teacher.fullName)
        setEmail(teacher.email)
        setPhone(teacher.phone ?? '')
        setSports(teacher.sports)
        setRemunerationModel(teacher.remunerationModel)
        setRemunerationValue(String(teacher.remunerationValue))
        setCertifications(teacher.certifications ?? '')
        setBio(teacher.bio ?? '')
        if (availabilityResult.ok) {
          setExistingAvailability(availabilityResult.availability)
        }
        setLoadState({ status: 'ready' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [isEdit, teacherId])

  function toggleSport(slug: string) {
    setSports((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function toggleLocalSlot(dayOfWeek: DayOfWeek, timeSlot: AvailabilityTimeSlot) {
    const key = slotKey(dayOfWeek, timeSlot)
    setLocalAvailability((prev) => {
      const next = new Map(prev)
      next.set(key, !(prev.get(key) ?? false))
      return next
    })
  }

  function validate(): string | null {
    if (!fullName.trim()) return 'Nome completo é obrigatório'
    if (!isEdit && !email.trim()) return 'E-mail é obrigatório'
    if (!phone.trim()) return 'Telefone é obrigatório'
    if (sports.length === 0) return 'Selecione ao menos um esporte'
    const numericValue = Number(remunerationValue)
    if (!remunerationValue.trim() || Number.isNaN(numericValue) || numericValue <= 0) {
      return 'Informe um valor de remuneração válido'
    }
    if (!isEdit) {
      if (!inviteEmail && !inviteWhatsapp) {
        return 'Selecione ao menos um canal de convite (e-mail ou WhatsApp)'
      }
      const hasAnySlot = Array.from(localAvailability.values()).some(Boolean)
      if (!hasAnySlot) return 'Marque ao menos uma faixa de disponibilidade'
    }
    return null
  }

  async function submitCreate(confirmExistingAccount: boolean) {
    if (!unitId) return
    setSubmitting(true)
    setError(null)
    const result = await createTeacher(unitId, {
      fullName,
      email,
      phone: phone || undefined,
      remunerationModel,
      remunerationValue: Number(remunerationValue),
      sports,
      certifications: certifications || undefined,
      bio: bio || undefined,
      inviteChannels: { email: inviteEmail, whatsapp: inviteWhatsapp },
      confirmExistingAccount,
    }).catch(
      () =>
        ({ ok: false as const, status: 0, error: 'network_error', message: undefined }) satisfies CreateTeacherResult,
    )
    setSubmitting(false)

    if (result.ok) {
      setAccountExists(null)
      if (result.kind === 'created') {
        const trueSlots: AvailabilitySlot[] = Array.from(localAvailability.entries())
          .filter(([, available]) => available)
          .map(([key, available]) => {
            const [dayOfWeek, timeSlot] = key.split('|') as [string, AvailabilityTimeSlot]
            return { dayOfWeek: Number(dayOfWeek) as DayOfWeek, timeSlot, available }
          })
        if (trueSlots.length > 0) {
          // Best-effort (ver comentário de módulo) — não bloqueia a
          // navegação se falhar, o professor já foi criado.
          await patchAvailability(result.teacherId, trueSlots).catch(() => undefined)
        }
        navigate(unitId ? `/units/${unitId}/teachers/${result.teacherId}` : '/dashboard')
        return
      }
      navigate(unitId ? `/units/${unitId}/teachers` : '/dashboard')
      return
    }

    if ('email' in result && result.error === 'account_exists') {
      setAccountExists(result)
      return
    }
    setAccountExists(null)
    setError(
      result.error === 'already_registered'
        ? (result.message ?? 'Este e-mail já está cadastrado nesta unidade')
        : (result.message ?? `Não foi possível cadastrar o professor (${result.error}).`),
    )
  }

  async function submitEdit() {
    if (!teacherId) return
    setSubmitting(true)
    setError(null)

    const [patchResult, remunerationResult] = await Promise.all([
      patchTeacher(teacherId, {
        fullName,
        phone: phone || undefined,
        sports,
        certifications: certifications || undefined,
        bio: bio || undefined,
      }),
      patchRemuneration(teacherId, {
        remunerationModel,
        remunerationValue: Number(remunerationValue),
      }),
    ])
    setSubmitting(false)

    if (!patchResult.ok || !remunerationResult.ok) {
      setError('Não foi possível salvar as alterações. Tente novamente.')
      return
    }

    navigate(unitId ? `/units/${unitId}/teachers/${teacherId}` : '/dashboard')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setAccountExists(null)
      return
    }
    if (isEdit) {
      await submitEdit()
    } else {
      await submitCreate(false)
    }
  }

  async function handleConfirmExistingAccount() {
    await submitCreate(true)
  }

  if (!canWrite) {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <div className="dash-body">
          <p role="alert">Você não tem permissão para {isEdit ? 'editar' : 'cadastrar'} professores nesta unidade.</p>
        </div>
      </AppShell>
    )
  }

  if (isEdit && loadState.status === 'loading') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <PageLoading label="Carregando professor" />
      </AppShell>
    )
  }
  if (isEdit && loadState.status === 'error') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <p role="alert">Não foi possível carregar este professor.</p>
      </AppShell>
    )
  }
  if (isEdit && loadState.status === 'not-found') {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <p role="alert">Professor não encontrado.</p>
      </AppShell>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link
          className="back"
          to={
            isEdit && unitId && teacherId
              ? `/units/${unitId}/teachers/${teacherId}`
              : unitId
                ? `/units/${unitId}/teachers`
                : '/dashboard'
          }
        >
          ‹ {isEdit ? 'Professor' : 'Professores'}
        </Link>
        <h1>{isEdit ? 'Editar professor' : 'Novo professor'}</h1>
        <div className="spacer" />
      </div>

      <form className="dash-body new-unit-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="teacher-name">Nome completo</label>
          <input
            id="teacher-name"
            className="input"
            value={fullName}
            disabled={submitting}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="teacher-email">E-mail</label>
          <input
            id="teacher-email"
            type="email"
            className="input"
            value={email}
            disabled={submitting || isEdit}
            onChange={(e) => setEmail(e.target.value)}
          />
          {isEdit ? (
            <span className="hint">E-mail não pode ser alterado por aqui.</span>
          ) : (
            <span className="hint">Se já existir conta com este e-mail, só vinculamos à arena.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="teacher-phone">Telefone</label>
          <input
            id="teacher-phone"
            className="input"
            value={phone}
            disabled={submitting}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Esportes que leciona</label>
          <div className="tabs2">
            {SPORTS.map((sport) => (
              <button
                key={sport.slug}
                type="button"
                className={sports.includes(sport.slug) ? 'active' : ''}
                disabled={submitting}
                onClick={() => toggleSport(sport.slug)}
              >
                {sport.label}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="remuneration-fieldset">
          <legend>Modelo de remuneração</legend>
          {MODEL_OPTIONS.map((option) => (
            <label key={option.value} className="radio-row">
              <input
                type="radio"
                name="remuneration-model"
                value={option.value}
                checked={remunerationModel === option.value}
                disabled={submitting}
                onChange={() => setRemunerationModel(option.value)}
              />
              <span className="radio-row__label">{option.label}</span>
              {remunerationModel === option.value ? (
                <span className="radio-row__input">
                  {option.value !== 'commission' ? <span className="prefix">R$</span> : null}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={remunerationValue}
                    disabled={submitting}
                    onChange={(e) => setRemunerationValue(e.target.value)}
                  />
                  <span className="suffix">{option.unitLabel}</span>
                </span>
              ) : null}
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label>Disponibilidade</label>
          <span className="hint">Toque para marcar disponível.</span>
          {isEdit && teacherId ? (
            <AvailabilityGrid mode="edit" teacherId={teacherId} slots={existingAvailability} />
          ) : (
            <LocalAvailabilityGrid bySlot={localAvailability} onToggle={toggleLocalSlot} />
          )}
        </div>

        <div className="field">
          <label htmlFor="teacher-certifications">Certificações</label>
          <input
            id="teacher-certifications"
            className="input"
            value={certifications}
            disabled={submitting}
            onChange={(e) => setCertifications(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="teacher-bio">Bio</label>
          <textarea
            id="teacher-bio"
            className="input"
            rows={3}
            value={bio}
            disabled={submitting}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        {!isEdit ? (
          <div className="field">
            <label>Convite</label>
            <Checkbox
              label="Enviar convite por e-mail"
              checked={inviteEmail}
              disabled={submitting}
              onChange={setInviteEmail}
            />
            <Checkbox
              label="Enviar convite por WhatsApp"
              checked={inviteWhatsapp}
              disabled={submitting}
              onChange={setInviteWhatsapp}
            />
          </div>
        ) : null}

        {accountExists ? (
          <div className="account-banner" role="status">
            <p>{accountExists.message}</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={submitting}
              onClick={handleConfirmExistingAccount}
            >
              Vincular a esta arena
            </button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}

        <button className="btn btn-primary btn-md" type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar e convidar'}
        </button>
      </form>
    </AppShell>
  )
}

/** Grade local (modo criar) — sem persistência por clique, ver comentário de
 * módulo no topo do arquivo. */
function LocalAvailabilityGrid({
  bySlot,
  onToggle,
}: {
  bySlot: Map<string, boolean>
  onToggle: (dayOfWeek: DayOfWeek, timeSlot: AvailabilityTimeSlot) => void
}) {
  return (
    <div className="availability-grid">
      <table className="availability-grid__table">
        <thead>
          <tr>
            <th scope="col" className="availability-grid__corner" />
            {DAYS.map((day) => (
              <th scope="col" key={day}>
                {DAY_SHORT_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AVAILABILITY_TIME_SLOTS.map((timeSlot) => (
            <tr key={timeSlot}>
              <th scope="row" className="availability-grid__row-label">
                {timeSlot}
              </th>
              {DAYS.map((day) => {
                const available = bySlot.get(slotKey(day, timeSlot)) ?? false
                return (
                  <td key={day}>
                    <button
                      type="button"
                      className="availability-cell availability-cell--edit"
                      data-status={available ? 'available' : 'unavailable'}
                      aria-pressed={available}
                      aria-label={`${DAY_SHORT_LABELS[day]} ${timeSlot}`}
                      onClick={() => onToggle(day, timeSlot)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
