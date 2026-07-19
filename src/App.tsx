import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom'
import { PermissionsProvider } from './context/PermissionsContext'
import { SESSION_EXPIRED_EVENT } from './lib/httpClient'
import AG1DayPage from './pages/Agenda/AG1DayPage'
import AG2WeekPage from './pages/Agenda/AG2WeekPage'
import AG3StudentAgendaPage from './pages/Agenda/AG3StudentAgendaPage'
import AG5BookingDetailPage from './pages/Agenda/AG5BookingDetailPage'
import CheckinPage from './pages/Agenda/CheckinPage'
import ArenaSettingsPage from './pages/ArenaSettings/ArenaSettingsPage'
import { CadastroPage } from './pages/cadastro/CadastroPage'
import { CompletarCadastro } from './pages/CompletarCadastro'
import DashboardPage from './pages/DashboardPage'
import { ForgotPassword } from './pages/ForgotPassword'
import LoginPage from './pages/LoginPage'
import MembersPage from './pages/Members/MembersPage'
import { OAuthCallback } from './pages/OAuthCallback'
import ProfilePage from './pages/Profile/ProfilePage'
import { ResetPassword } from './pages/ResetPassword'
import RolesPage from './pages/Roles/RolesPage'
import S1Page from './pages/S1Page'
import { SignupPage } from './pages/SignupPage'
import NewStudentPage from './pages/Students/NewStudentPage'
import StudentProfilePage from './pages/Students/StudentProfilePage'
import { TournamentViewPage } from './pages/TournamentView/TournamentViewPage'
import TurmaDetailPage from './pages/Turmas/TurmaDetailPage'
import TurmasListPage from './pages/Turmas/TurmasListPage'
import NewUnitPage from './pages/Units/NewUnitPage'
import UnitsPage from './pages/Units/UnitsPage'
import { VerifyEmailPage } from './pages/VerifyEmail/VerifyEmailPage'
import { VisitorRequestPage } from './pages/VisitorRequest/VisitorRequestPage'
import { VisitorVerifyPage } from './pages/VisitorVerify/VisitorVerifyPage'

/**
 * Escuta o evento global disparado pelo interceptor HTTP (BEAC-1793) quando
 * um 401 não é resolvido nem por um refresh — nesse caso, a sessão expirou
 * de fato e a app deve voltar para o login.
 */
function useSessionExpiredRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleSessionExpired() {
      navigate('/login', { replace: true })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [navigate])
}

function AppRoutes() {
  useSessionExpiredRedirect()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      {/* /verify-email é a tela A4 real de verificação de e-mail
          (BEAC-1676/1812). O antigo stub /verificacao-email (BEAC-1673/1788)
          foi removido — CadastroPage navega direto pra cá. */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      {/* Tela de completar cadastro via convite (BEAC-1860, story BEAC-1689)
          — o aluno chega aqui pelo link de convite criado por BEAC-1858
          (Admin cadastra aluno), com ?email=...&invite=<código do convite>. */}
      <Route path="/completar-cadastro" element={<CompletarCadastro />} />
      {/* /oauth/callback mantida só por retrocompatibilidade (ver
          pages/OAuthCallback.tsx) — desde a correção de arquitetura de
          BEAC-1815, o backend redireciona sucesso/falha direto para
          /dashboard ou /login. */}
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/s1" element={<S1Page />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      {/* PF3/OW2/OW3 — story BEAC-1680 (BEAC-1832): shell mínima de perfil e
          o fluxo de criação de Unit adicional em rede existente. */}
      <Route path="/perfil" element={<ProfilePage />} />
      {/* BEAC-1844/1845 (story BEAC-1686, "Aba Papéis em C3: atribuição de
          papel a usuário"): unit-scoped, mesma forma da rota do endpoint
          que consome (GET/PATCH /units/{id}/members). */}
      <Route path="/units/:unitId/members" element={<MembersPage />} />
      {/* AL3 — Novo aluno (BEAC-1858/1859, story BEAC-1688: "Formulário de
          cadastro de aluno com responsável legal"). Unit-scoped, mesma
          forma do endpoint que consome (POST /units/{id}/students). */}
      <Route path="/units/:unitId/students/new" element={<NewStudentPage />} />
      {/* AL2 — Perfil do Aluno, scaffold (BEAC-1871, story BEAC-1691) +
          seção "Nível por esporte" (BEAC-1856). Rota unit-scoped, mesma
          convenção de /units/:unitId/students/new (BEAC-1858/1859, story
          irmã BEAC-1688) — react-router prioriza o segmento literal "new"
          acima sobre o :studentId dinâmico aqui, então não há colisão. */}
      <Route path="/units/:unitId/students/:studentId" element={<StudentProfilePage />} />
      <Route path="/tenants/:tenantId/units" element={<UnitsPage />} />
      <Route path="/tenants/:tenantId/units/new" element={<NewUnitPage />} />
      {/* C3 — Papéis e permissões (BEAC-1843, story BEAC-1684), com a aba
          Histórico (BEAC-1848, story BEAC-1687) hospedada ao lado. Rota
          unit-scoped (não tenant-scoped): espelha o endpoint que ela
          consome, POST/GET/PATCH /units/{id}/roles (BEAC-1842). */}
      <Route path="/units/:unitId/roles" element={<RolesPage />} />
      {/* C1 — Configurações da arena (BEAC-1867, story BEAC-1694), seção
          "Bloqueio por inadimplência" nesta etapa. Rota unit-scoped (não
          tenant-scoped): espelha o endpoint que ela consome, GET/PATCH
          /units/{id}/settings/delinquency-block-level (BEAC-1866), mesmo
          padrão de /units/:unitId/roles e /units/:unitId/members. */}
      <Route path="/units/:unitId/settings" element={<ArenaSettingsPage />} />
      {/* AG1/AG2 — Calendário Dia/Semana (BEAC-1903, story BEAC-1704 "CRUD de
          turma com recorrência semanal"). Dois componentes deliberadamente
          separados (decisão travada do dispatch) — não uma variação de props
          de um só. Rota unit-scoped, mesmo padrão de /units/:unitId/roles. */}
      <Route path="/units/:unitId/agenda" element={<AG1DayPage />} />
      <Route path="/units/:unitId/agenda/semana" element={<AG2WeekPage />} />
      {/* AG3 — Minha agenda (Aluno) (BEAC-1926, mesma story). */}
      <Route path="/units/:unitId/agenda/minha" element={<AG3StudentAgendaPage />} />
      {/* AG5 — Detalhe da Aula/Reserva, base only (BEAC-1905, mesma story).
          AG1DayPage/AG2WeekPage navegam pra cá passando o Booking já
          carregado via router state (ver comentário de pacote de
          AG5BookingDetailPage.tsx — sem GET /bookings/{id} para deep link
          direto). */}
      <Route path="/units/:unitId/bookings/:bookingId" element={<AG5BookingDetailPage />} />
      {/* T3 — Check-in de Presença (BEAC-1907, mesma story). Alcançada a
          partir de AG5 ("Abrir Check-in", Professor) — mesmo padrão de
          router state de AG5 acima (sem GET /bookings/{id}, ver comentário
          de pacote de CheckinPage.tsx). */}
      <Route path="/units/:unitId/bookings/:bookingId/checkin" element={<CheckinPage />} />
      {/* T1/T2 — Lista de turmas / Detalhe da turma (BEAC-1900/1901, mesma
          story BEAC-1704 "CRUD de turma com recorrência semanal"). Rotas
          unit-scoped, mesmo padrão de /units/:unitId/agenda(/semana) acima:
          T1 consome GET /units/{id}/classes (endpoint de listagem adicionado
          nesta mesma dispatch, ver comentário de pacote em
          lib/api/classes.ts/TurmasListPage.tsx); T2 reaproveita a mesma
          listagem (sem GET /classes/{id} dedicado) e localiza a turma por
          :classId client-side. "new"/segmentos literais não colidem aqui
          (T2 usa :classId como segundo segmento dinâmico, não um literal). */}
      <Route path="/units/:unitId/classes" element={<TurmasListPage />} />
      <Route path="/units/:unitId/classes/:classId" element={<TurmaDetailPage />} />
      {/* A5 — Magic link de visitante de torneio (BEAC-1817). */}
      <Route path="/tournaments/:tournamentId/visitor" element={<VisitorRequestPage />} />
      <Route path="/tournaments/:tournamentId/visitor/verify" element={<VisitorVerifyPage />} />
      <Route path="/tournaments/:tournamentId" element={<TournamentViewPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      {/* PermissionsProvider (BEAC-1841) precisa envolver toda a árvore de
          rotas autenticadas: usePermission é o mecanismo de UI de permissão
          do qual todo outro épico/feature depende, então nenhuma tela pode
          ficar fora do seu alcance. */}
      <PermissionsProvider>
        <AppRoutes />
      </PermissionsProvider>
    </BrowserRouter>
  )
}

export default App
