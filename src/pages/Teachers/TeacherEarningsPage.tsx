import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getEarnings, type Earnings } from '../../lib/api/earnings'
import { getTeacher } from '../../lib/api/teachers'
import { EarningsSummary } from './EarningsSummary'
import '../../components/AuthLayout/AuthLayout.css'
import '../Students/NewStudentPage.css'
import './TeacherProfilePage.css'
import { PageLoading } from '../../components/ui/PageLoading/PageLoading'
import './TeacherEarningsPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; earnings: Earnings; remunerationValue: number }

/**
 * PR4 — Meus Ganhos (BEAC-1700/BEAC-1884, story BEAC-1699/feature BEAC-1635
 * wave 1). Sem doc própria no Allye (grep confirmado) — layout/copy lidos
 * diretamente do protótipo real (Artifact "Rallye — Pessoas & Turmas", seção
 * `scr-pr4`): toast fixo somente-leitura, stat4 (Modelo/Aulas dadas/A
 * receber/Já recebido), gráfico "Histórico mensal".
 *
 * ## Detalhamento de turma (BEAC-1701/BEAC-1886)
 *
 * Consome `earnings.breakdown` (BEAC-1885, novo campo do mesmo endpoint) —
 * SÓ populado para o modelo per_class (ver comentário de pacote
 * de src/lib/api/earnings.ts); fixed/commission mostram uma mensagem
 * explicando o gap em vez de uma lista vazia silenciosa. "Alunos/aula em
 * média" do protótipo NÃO é renderizado — sem fonte de dado real disponível
 * (AC desta task: não inventar a média, mostrar só a contagem de aulas).
 *

 * Mesma fonte de dados de PR2/aba Comissão (GET /teachers/{id}/earnings,
 * decisão travada do Épico 5: "os valores batem exatamente com a aba
 * Comissão de PR2") — mas usa os 6 meses inteiros de `history[]` (PR2/
 * Comissão usa só os últimos 3), e os campos do stat4 são outros
 * (classes_given_in_period/pending_amount/paid_amount, não
 * revenue_generated/current_month_amount).
 *
 * `remuneration_value` não vem de GET /earnings (só `remuneration_model`) —
 * mesmo gap que ComissaoTab (TeacherProfilePage.tsx) resolve recebendo o
 * value via prop do professor já carregado pela página-pai; aqui, como esta
 * é uma rota própria (sem página-pai carregando o professor), busca-se
 * também GET /teachers/{id} em paralelo só para esse valor.
 *
 * Autorização: SEM gate de permissão no frontend — GetHandler
 * (api/internal/earnings/handler.go) já faz bypass de self (o próprio
 * professor sempre acessa os próprios ganhos, mesmo sem professores:read,
 * que o role Professor não tem na matriz de seed) com fallback para
 * professores:read (Admin, "Ver como o professor vê" em PR2). Gatear aqui
 * com usePermission('professores','read') esconderia a tela do PRÓPRIO
 * professor, o oposto do que o backend garante.
 *
 * ## Acesso / PF2
 *
 * O AC pede acesso "via item de menu a partir de PF2 (Meu Perfil -
 * Professor)" — PF2 não existe nesta base ainda (grep confirmado, fora de
 * escopo desta task). O link "‹ Meu perfil" do protótipo aponta para cá;
 * como não há PF2, o back-link desta página volta para o perfil do
 * professor em PR2 (rota de onde o Admin efetivamente chega hoje, via botão
 * "Ver como o professor vê" da aba Comissão) — gap comentado, não construir
 * PF2 aqui.
 */
export default function TeacherEarningsPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, teacherId } = useParams<{ unitId: string; teacherId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false

    Promise.all([getEarnings(teacherId), getTeacher(teacherId)]).then(
      ([earningsResult, teacherResult]) => {
        if (cancelled) return
        if (!earningsResult.ok || !teacherResult.ok) {
          setState({ status: 'error' })
          return
        }
        setState({
          status: 'ready',
          earnings: earningsResult.earnings,
          remunerationValue: teacherResult.teacher.remunerationValue,
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [teacherId])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link className="back" to={unitId && teacherId ? `/units/${unitId}/teachers/${teacherId}` : '/dashboard'}>
          ‹ Meu perfil
        </Link>
        <h1 style={{ fontSize: 18 }}>Meus ganhos</h1>
        <div className="spacer" />
      </div>

      {state.status === 'loading' ? <PageLoading label="Carregando ganhos" variant="section" /> : null}
      {state.status === 'error' ? <p role="alert">Não foi possível carregar seus ganhos.</p> : null}

      {state.status === 'ready' ? (
        <div className="dash-body">
          {/* key={teacherId}: força remontar (e reiniciar o mês selecionado)
              quando o :teacherId da rota muda sem desmontar esta página. */}
          <EarningsSummary key={teacherId} earnings={state.earnings} remunerationValue={state.remunerationValue} />
        </div>
      ) : null}
    </AppShell>
  )
}
