import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Checkbox } from '../../components/ui/Checkbox/Checkbox'
import { Input } from '../../components/ui/Input/Input'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { listMembers, type Member } from '../../lib/api/members'
import { createInvoice, type CreateInvoiceType } from '../../lib/api/invoices'
import { prefillForType } from '../../lib/invoicePrefill'
import './Financeiro.css'
import '../../components/AuthLayout/AuthLayout.css'

const TYPE_OPTIONS: { value: CreateInvoiceType; label: string }[] = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'torneio', label: 'Torneio' },
  { value: 'avulso', label: 'Avulso' },
]

function currentMonthLabel(): string {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const now = new Date()
  return `${months[now.getMonth()]}/${now.getFullYear()}`
}

/**
 * F4 — Criar Cobrança (BEAC-1949, story BEAC-1710). Markup segue o doc real
 * "F4 — Criar Cobrança" (Allye, ID 8cefe87e-8075-415a-bc5f-3747068eaa13):
 * busca de aluno, pills de tipo, descrição/valor/vencimento, checkboxes
 * (gerar link/WhatsApp/email, default marcados), CTA desabilitado até
 * campos obrigatórios preenchidos.
 *
 * Busca de aluno: reaproveita GET /units/{id}/members (BEAC-1844, já
 * existente) filtrado client-side por role.name === 'Aluno' — não existe
 * (nem está no escopo de BEAC-1942) um endpoint de listagem/busca dedicado
 * de alunos; members já devolve id/nome/role de toda membership ativa da
 * unit, então é a fonte real mais próxima sem inventar um endpoint novo.
 *
 * Pre-fill por tipo: ver lib/invoicePrefill.ts (gap documentado lá — sem
 * fonte de dado de plano/torneio nesta dispatch, só o prefixo textual é
 * pré-preenchido para mensalidade/pacote/torneio; avulso é 100% coberto).
 *
 * BEAC-2112 (restyle Claude Design): os 4 campos de texto (aluno/descrição/
 * valor/vencimento) e os 3 checkboxes de entrega passaram a usar ui/Input e
 * ui/Checkbox (mesmo padrão de F3InvoiceDetailPage.tsx, BEAC-2111) — `.pills`
 * (tipo), `.card`/`.inv-row` (sugestões de aluno) e `.btn btn-primary`
 * continuam classes cruas retokenizadas em Financeiro.css (decisão travada
 * de BEAC-2111, mesma razão: sem componente ui/ equivalente sem perder
 * comportamento observável).
 */
export default function F4CreateInvoicePage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  const [studentQuery, setStudentQuery] = useState('')
  const debouncedQuery = useDebouncedValue(studentQuery, 300)
  const [students, setStudents] = useState<Member[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Member | null>(null)

  const [type, setType] = useState<CreateInvoiceType>('avulso')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [generateLink, setGenerateLink] = useState(true)
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Sem setState síncrono no corpo do efeito (react-hooks/set-state-in-effect):
    // quando não há o que buscar, simplesmente não busca — `students`
    // desatualizado fica escondido pela guarda de render abaixo
    // (`!selectedStudent && debouncedQuery.trim() !== ''`), não precisa ser
    // limpo aqui.
    if (!unitId || debouncedQuery.trim() === '' || selectedStudent) return
    let cancelled = false
    listMembers(unitId, debouncedQuery).then((result) => {
      if (cancelled || !result.ok) return
      setStudents(result.members.filter((m) => m.role?.name === 'Aluno'))
    })
    return () => {
      cancelled = true
    }
  }, [unitId, debouncedQuery, selectedStudent])

  function handleTypeSelect(next: CreateInvoiceType) {
    setType(next)
    const prefill = prefillForType(next, currentMonthLabel())
    setDescription(prefill.description)
    if (prefill.amount != null) setAmount(String(prefill.amount))
  }

  const amountNumber = Number(amount.replace(',', '.'))
  const canSubmit =
    !!selectedStudent &&
    description.trim() !== '' &&
    amountNumber > 0 &&
    dueDate !== '' &&
    !submitting

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  async function handleSubmit() {
    if (!unitId || !selectedStudent || !canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)
    const result = await createInvoice(unitId, {
      studentId: selectedStudent.user.id,
      type,
      description: description.trim(),
      amount: amountNumber,
      dueDate,
      generateLink,
      sendWhatsApp,
      sendEmail,
    })
    setSubmitting(false)
    if (!result.ok) {
      setErrorMessage(
        result.error === 'invalid_body'
          ? (result.message ?? 'Verifique os campos e tente novamente.')
          : 'Não foi possível criar a cobrança.',
      )
      return
    }
    navigate(`/units/${unitId}/invoices`)
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <button type="button" className="back" onClick={() => navigate(-1)}>
          ‹ Cancelar
        </button>
        <h1>Criar Cobrança</h1>
      </div>

      <div className="dash-body">
        <div>
          <Input
            id="student-search"
            label="ALUNO *"
            type="text"
            placeholder="🔍 Buscar aluno..."
            value={selectedStudent ? selectedStudent.user.name : studentQuery}
            onChange={(e) => {
              setSelectedStudent(null)
              setStudentQuery(e.target.value)
            }}
          />
          {students.length > 0 && !selectedStudent && studentQuery.trim() !== '' ? (
            <div className="fin-card" style={{ marginTop: 6 }}>
              {students.map((m) => (
                <button
                  key={m.membershipId}
                  type="button"
                  className="inv-row"
                  onClick={() => {
                    setSelectedStudent(m)
                    setStudents([])
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
        </div>

        <div className="field">
          <label>TIPO</label>
          <div className="pills">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={type === opt.value ? 'active' : ''}
                onClick={() => handleTypeSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          id="description"
          label="DESCRIÇÃO *"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          id="amount"
          label="VALOR *"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Input
          id="due-date"
          label="VENCIMENTO *"
          type="date"
          min={todayISO}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <Checkbox
          label="Gerar link de pagamento"
          checked={generateLink}
          onChange={setGenerateLink}
        />
        <Checkbox label="Enviar por WhatsApp" checked={sendWhatsApp} onChange={setSendWhatsApp} />
        <Checkbox label="Enviar por email" checked={sendEmail} onChange={setSendEmail} />

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}

        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          CRIAR COBRANÇA
        </button>
      </div>
    </AppShell>
  )
}
