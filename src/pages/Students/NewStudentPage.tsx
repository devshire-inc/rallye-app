import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Checkbox } from '../../components/ui/Checkbox/Checkbox'
import { usePermission } from '../../hooks/usePermission'
import {
  createStudent,
  type CreateStudentAccountExists,
  type CreateStudentResult,
} from '../../lib/api/students'
import { isMinor } from '../../lib/age'
import { SPORTS } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import '../Units/NewUnitPage.css'
import './NewStudentPage.css'

/**
 * AL3 — Novo aluno (BEAC-1858/BEAC-1859, story BEAC-1688 "Formulário de
 * cadastro de aluno com responsável legal"). Adapta o formulário real do
 * protótipo (Allye doc AL3 — "Cadastro/Edição de Aluno", a task chamava esta
 * tela de "AL1" mas o doc real do protótipo é AL3; AL1 no doc tree é a
 * LISTA de alunos, fora de escopo desta story — confirmado lendo o doc antes
 * de implementar, não assumido do texto da task):
 *
 *   - Campo "Nível" REMOVIDO (decisão travada desta story — não é mais
 *     coletado no cadastro).
 *   - Esportes continua como chips multi-seleção, mas é SÓ seleção de UI: o
 *     endpoint de BEAC-1858 não aceita nem consome esse campo (o backend
 *     ainda não decidiu como isso vira student_skill_levels — ver comentário
 *     de pacote em api/internal/students/handler.go) — não enviado no POST.
 *   - Responsável legal (nome/telefone/CPF) aparece e é exigido quando
 *     birth_date indica menor de 18 anos (mesma regra de api/internal/
 *     students/handler.go's isMinor, replicada em src/lib/age.ts só para
 *     feedback inline — o backend é quem de fato valida).
 *   - Banner "conta já existe" (scr-al, estado "Email já existe" do doc AL3)
 *     replicado a partir do sinal 409 account_exists do backend: mostra a
 *     mensagem e oferece confirmar para só vincular a membership (sem
 *     duplicar conta, sem novo invite — ver comentário de createStudent).
 *   - "Email já é membro" (409 already_registered) bloqueia com erro, sem
 *     oferecer confirmação.
 *
 * Regra de permissão "esconder sempre, nunca desabilitar" (Padrões
 * Transversais — UX e RBAC, item 2, doc Allye): a tela inteira não renderiza
 * nada além de um aviso quando o usuário não tem permissão write em
 * 'alunos' — não existe uma versão "desabilitada" desta tela.
 */
export default function NewStudentPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const canWrite = usePermission('alunos', 'write')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [cpf, setCpf] = useState('')
  const [sports, setSports] = useState<string[]>([])
  const [observations, setObservations] = useState('')
  const [guardianNome, setGuardianNome] = useState('')
  const [guardianTelefone, setGuardianTelefone] = useState('')
  const [guardianCpf, setGuardianCpf] = useState('')
  const [inviteEmail, setInviteEmail] = useState(true)
  const [inviteWhatsapp, setInviteWhatsapp] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState<CreateStudentAccountExists | null>(null)

  const minor = birthDate.trim() !== '' && isMinor(birthDate)

  function toggleSport(slug: string) {
    setSports((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function validate(): string | null {
    if (!fullName.trim()) return 'Nome completo é obrigatório'
    if (!email.trim()) return 'E-mail é obrigatório'
    if (minor && (!guardianNome.trim() || !guardianTelefone.trim())) {
      return 'Nome e telefone do responsável legal são obrigatórios para aluno menor de 18 anos'
    }
    if (!inviteEmail && !inviteWhatsapp) {
      return 'Selecione ao menos um canal de convite (e-mail ou WhatsApp)'
    }
    return null
  }

  async function submit(confirmExistingAccount: boolean) {
    if (!unitId) return

    setSubmitting(true)
    setError(null)
    const result = await createStudent(unitId, {
      fullName,
      email,
      phone: phone || undefined,
      birthDate: birthDate || undefined,
      cpf: cpf || undefined,
      observations: observations || undefined,
      guardian: minor
        ? { nome: guardianNome, telefone: guardianTelefone, cpf: guardianCpf || undefined }
        : undefined,
      inviteChannels: { email: inviteEmail, whatsapp: inviteWhatsapp },
      confirmExistingAccount,
    })
      .catch(
        () =>
          ({
            ok: false as const,
            status: 0,
            error: 'network_error',
            message: undefined,
          }) satisfies CreateStudentResult,
      )
    setSubmitting(false)

    if (result.ok) {
      setAccountExists(null)
      navigate('/dashboard')
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
        : (result.message ?? `Não foi possível cadastrar o aluno (${result.error}).`),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setAccountExists(null)
      return
    }
    await submit(false)
  }

  async function handleConfirmExistingAccount() {
    await submit(true)
  }

  if (!canWrite) {
    return (
      <>
        <div className="dash-body">
          <p role="alert">Você não tem permissão para cadastrar alunos nesta unidade.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="pg-head">
        <Link className="back" to={unitId ? `/units/${unitId}/members` : '/dashboard'}>
          ‹ Alunos
        </Link>
        <h1>Novo aluno</h1>
        <div className="spacer" />
      </div>

      <form className="dash-body new-unit-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="student-name">Nome completo</label>
          <input
            id="student-name"
            className="input"
            value={fullName}
            disabled={submitting}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="student-email">E-mail</label>
          <input
            id="student-email"
            type="email"
            className="input"
            value={email}
            disabled={submitting}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="hint">Se já existir conta com este e-mail, só vinculamos à arena.</span>
        </div>

        <div className="two-col">
          <div className="field">
            <label htmlFor="student-phone">Telefone / WhatsApp</label>
            <input
              id="student-phone"
              className="input"
              value={phone}
              disabled={submitting}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="student-birth-date">Data de nascimento</label>
            <input
              id="student-birth-date"
              type="date"
              className="input"
              value={birthDate}
              disabled={submitting}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="student-cpf">CPF</label>
          <input
            id="student-cpf"
            className="input"
            value={cpf}
            disabled={submitting}
            onChange={(e) => setCpf(e.target.value)}
          />
          <span className="hint">Só para emissão de NF-e.</span>
        </div>

        <div className="field">
          <label>Esportes</label>
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

        {minor ? (
          <fieldset className="guardian-fieldset">
            <legend>Responsável legal (obrigatório — aluno menor de 18 anos)</legend>
            <div className="field">
              <label htmlFor="guardian-name">Nome do responsável</label>
              <input
                id="guardian-name"
                className="input"
                value={guardianNome}
                disabled={submitting}
                onChange={(e) => setGuardianNome(e.target.value)}
              />
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="guardian-phone">Telefone do responsável</label>
                <input
                  id="guardian-phone"
                  className="input"
                  value={guardianTelefone}
                  disabled={submitting}
                  onChange={(e) => setGuardianTelefone(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="guardian-cpf">CPF do responsável</label>
                <input
                  id="guardian-cpf"
                  className="input"
                  value={guardianCpf}
                  disabled={submitting}
                  onChange={(e) => setGuardianCpf(e.target.value)}
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        <div className="field">
          <label htmlFor="student-observations">Observações</label>
          <textarea
            id="student-observations"
            className="input"
            rows={3}
            value={observations}
            disabled={submitting}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>

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
          {submitting ? 'Cadastrando…' : 'Cadastrar e convidar'}
        </button>
      </form>
    </>
  )
}
