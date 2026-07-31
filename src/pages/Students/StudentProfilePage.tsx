import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Avatar } from '../../components/ui/Avatar/Avatar'
import { Badge, type BadgeProps } from '../../components/ui/Badge/Badge'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { usePermission } from '../../hooks/usePermission'
import { getStudent, type Student, type StudentStatus } from '../../lib/api/students'
import { ClassHistorySection } from './ClassHistorySection'
import { SkillLevelsSection } from './SkillLevelsSection'
import '../../components/AuthLayout/AuthLayout.css'
import './StudentProfilePage.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; student: Student }

type Tab = 'dados' | 'plano' | 'faturas' | 'turmas' | 'progresso'

const STATUS_LABEL: Record<StudentStatus, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  inactive: 'Inativo',
}

/** Sem 'Inadimplente' aqui de propósito — public.students.status só modela
 * pending/active/inactive (migrations/000021); inadimplência é conceito
 * financeiro de uma feature futura (BEAC-1632), ainda não implementada. */
const STATUS_BADGE_TONE: Record<StudentStatus, BadgeProps['tone']> = {
  pending: 'warning',
  active: 'success',
  inactive: 'neutral',
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/**
 * AL2 — Perfil do Aluno (Admin View), scaffold (BEAC-1871, story BEAC-1691
 * "Tela AL2 com chips de nível por esporte") + aba "Turmas" real (BEAC-1864,
 * story BEAC-1693 "Histórico de turmas do aluno" — ver ClassHistorySection).
 * Escopo deliberadamente mínimo pro resto (decisão do usuário, ver handover
 * de dispatch): só o suficiente pra hospedar uma aba "Dados" funcional e a
 * aba "Turmas" — Plano/Faturas/Progresso continuam placeholders "Em breve",
 * sem chamada de API nenhuma, reservados pra features futuras (financeiro,
 * feedback de progresso).
 *
 * Markup segue o doc real "AL2 — Perfil do Aluno (Admin View)" (Allye, ID
 * f73c6c73-ba0c-41ac-b0bb-5de38b9ca093) + o protótipo real (scr-al2,
 * Artifact "Rallye — Pessoas & Turmas"): cabeçalho com avatar/nome/badge de
 * status, barra de 5 tabs, aba Dados com nascimento/CPF/observações. O
 * campo "Esportes"/"Nível" do doc NÃO aparece aqui como linha de kv — foi
 * substituído pela seção própria "Nível por esporte" (BEAC-1856,
 * SkillLevelsSection), decisão travada de que não existe mais um campo
 * único "nível do aluno" (ver Sistema de Níveis Rallye, Eixo 1).
 *
 * Rota `/units/:unitId/students/:studentId` — mesma convenção de
 * `/units/:unitId/students/new` (BEAC-1858/BEAC-1859, story irmã BEAC-1688,
 * ver NewStudentPage.tsx), unit-scoped porque o aluno só existe dentro do
 * contexto de uma unit.
 *
 * GAP CONHECIDO (não resolvido por esta task, ver comentário de módulo de
 * ../../lib/api/students.ts): `GET /units/{id}/students/{studentId}` ainda
 * NÃO existe no backend — checado api/internal/students/handler.go em
 * todos os worktrees de rallye-api disponíveis (só há o POST de
 * BEAC-1858). Por isso o cabeçalho/aba Dados desta tela usa um contrato
 * antecipado e não pode ser verificado ponta-a-ponta contra um backend real
 * ainda — mesmo padrão já aceito nesta base pra esse tipo de gap (memória
 * de implementação de BEAC-1860). A seção "Nível por esporte" (BEAC-1856)
 * NÃO tem esse problema: seu endpoint (BEAC-1853) já existe de verdade.
 *
 * Permissão: leitura da tela inteira exige `alunos:read` — "esconder
 * sempre, nunca desabilitar" (usePermission.ts): sem a permission, a página
 * não renderiza nada além do aviso. As abas Plano/Faturas exigem
 * `financeiro:read` (variação Professor do doc real: "não vê Plano/Faturas")
 * — quando ausente, os BOTÕES DA TAB somem da barra (nunca aparecem
 * desabilitados); a variação completa de Professor (menu ⚙️ de ações admin,
 * etc.) não é construída aqui — fora do escopo deste scaffold.
 */
export default function StudentProfilePage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, studentId } = useParams<{ unitId: string; studentId: string }>()
  const canRead = usePermission('alunos', 'read')
  const canSeeFinance = usePermission('financeiro', 'read')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('dados')

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const request =
        unitId && studentId
          ? getStudent(unitId, studentId)
          : Promise.reject(new Error('missing_params'))
      request
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState({ status: 'error' })
            return
          }
          setState({ status: 'ready', student: result.student })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, studentId],
  )

  useEffect(() => {
    // Sem alunos:read, nem tenta buscar — a tela inteira já vira só o aviso
    // de permissão (ver early return abaixo), então a chamada seria
    // desperdiçada (o backend recusaria de qualquer forma).
    if (!canRead) return
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load, canRead])

  // Derivado, não guardado em estado próprio (evita setState síncrono
  // dentro de efeito, react-hooks/set-state-in-effect — mesmo gotcha já
  // documentado na implementação de BEAC-1843/RolesPage): se a aba ativa é
  // uma restrita a financeiro:read e a permission some (ex.: troca de
  // sessão), a UI cai pra Dados sem nunca deixar uma tab escondida
  // "selecionada" no ar.
  const activeTab: Tab = !canSeeFinance && (tab === 'plano' || tab === 'faturas') ? 'dados' : tab

  if (!canRead) {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <div className="dash-body">
          <p role="alert">Você não tem permissão para ver o perfil deste aluno.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        {/* AL1 (lista de alunos) ainda não existe nesta base — aponta pra
            Perfil como destino de volta temporário, mesma solução já usada
            por RolesPage.tsx quando não há uma tela-pai própria hospedada. */}
        <Link className="back" to="/perfil">
          ‹ Perfil
        </Link>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <p role="status">Carregando aluno…</p> : null}
      {state.status === 'error' ? (
        <p role="alert">Não foi possível carregar os dados deste aluno.</p>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <div className="prof-head">
            <Avatar name={state.student.fullName} size="lg" />
            <div className="ph-main">
              <h1>
                {state.student.fullName}{' '}
                <Badge tone={STATUS_BADGE_TONE[state.student.status]}>
                  {STATUS_LABEL[state.student.status]}
                </Badge>
              </h1>
              <div className="mt">
                {state.student.email}
                {state.student.phone ? ` · ${state.student.phone}` : ''}
              </div>
            </div>
          </div>

          <div className="ptabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'dados'}
              className={activeTab === 'dados' ? 'active' : ''}
              onClick={() => setTab('dados')}
            >
              Dados
            </button>
            {canSeeFinance ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'plano'}
                className={activeTab === 'plano' ? 'active' : ''}
                onClick={() => setTab('plano')}
              >
                Plano
              </button>
            ) : null}
            {canSeeFinance ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'faturas'}
                className={activeTab === 'faturas' ? 'active' : ''}
                onClick={() => setTab('faturas')}
              >
                Faturas
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'turmas'}
              className={activeTab === 'turmas' ? 'active' : ''}
              onClick={() => setTab('turmas')}
            >
              Turmas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'progresso'}
              className={activeTab === 'progresso' ? 'active' : ''}
              onClick={() => setTab('progresso')}
            >
              Progresso
            </button>
          </div>

          <div className="dash-body">
            {activeTab === 'dados' ? (
              <div className="ptab-panel">
                <dl className="kv">
                  <dt>Nascimento</dt>
                  <dd>
                    {state.student.birthDate
                      ? formatDate(state.student.birthDate)
                      : 'Não informado'}
                  </dd>
                  <dt>CPF</dt>
                  <dd>{state.student.cpf ?? 'Não informado'}</dd>
                  <dt>Observações</dt>
                  <dd>{state.student.observations ?? '—'}</dd>
                </dl>

                <SkillLevelsSection studentId={state.student.id} />
              </div>
            ) : null}

            {/* Plano/Faturas/Progresso: stubs "Em breve" — sem chamada de
                API, reservados pras features futuras correspondentes
                (Épicos 5/7 do produto). Escopo deliberadamente mínimo desta
                task. Turmas (BEAC-1864) é real — ver ClassHistorySection. */}
            {activeTab === 'plano' && canSeeFinance ? (
              <div className="ptab-panel">
                <p className="hint">Em breve.</p>
              </div>
            ) : null}
            {activeTab === 'faturas' && canSeeFinance ? (
              <div className="ptab-panel">
                <p className="hint">Em breve.</p>
              </div>
            ) : null}
            {activeTab === 'turmas' && unitId ? (
              <ClassHistorySection unitId={unitId} studentId={state.student.id} />
            ) : null}
            {activeTab === 'progresso' ? (
              <div className="ptab-panel">
                <p className="hint">Em breve.</p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </AppShell>
  )
}
