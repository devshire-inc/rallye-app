import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom'
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle'
import { PermissionsProvider } from './context/PermissionsContext'
import { ThemeProvider } from './context/ThemeContext'
import { SESSION_ESTABLISHED_EVENT, SESSION_EXPIRED_EVENT } from './lib/httpClient'
import { appQueryClient } from './lib/query/queryClient'
import { resolveNotificationRoute } from './lib/notificationRouting'
import { PUSH_NOTIFICATION_TAPPED_EVENT, setupPushNotifications } from './lib/push'
import AG1DayPage from './pages/Agenda/AG1DayPage'
import AG2WeekPage from './pages/Agenda/AG2WeekPage'
import AG3StudentAgendaPage from './pages/Agenda/AG3StudentAgendaPage'
import AG4TeacherAgendaPage from './pages/Agenda/AG4TeacherAgendaPage'
import AG5BookingDetailPage from './pages/Agenda/AG5BookingDetailPage'
import AgendarConfirmarPage from './pages/Agenda/AgendarConfirmarPage'
import AgendarEscolherHorarioPage from './pages/Agenda/AgendarEscolherHorarioPage'
import AgendarSucessoPage from './pages/Agenda/AgendarSucessoPage'
import CheckinPage from './pages/Agenda/CheckinPage'
import ArenaSettingsPage from './pages/ArenaSettings/ArenaSettingsPage'
import BracketPage from './pages/Bracket/BracketPage'
import { CadastroPage } from './pages/cadastro/CadastroPage'
import { CompletarCadastro } from './pages/CompletarCadastro'
import DashboardPage from './pages/DashboardPage'
import DayUseBookingsPage from './pages/DayUse/DayUseBookingsPage'
import DayUseConfigPage from './pages/DayUse/DayUseConfigPage'
import DayUseConfirmPage from './pages/DayUse/DayUseConfirmPage'
import DayUseDetailPage from './pages/DayUse/DayUseDetailPage'
import DayUseDiscoveryPage from './pages/DayUse/DayUseDiscoveryPage'
import DayUseQrPage from './pages/DayUse/DayUseQrPage'
import BlockedByDelinquencyPage from './pages/Financeiro/BlockedByDelinquencyPage'
import F1CashFlowPage from './pages/Financeiro/F1CashFlowPage'
import F2InvoiceListPage from './pages/Financeiro/F2InvoiceListPage'
import F3InvoiceDetailPage from './pages/Financeiro/F3InvoiceDetailPage'
import F4CreateInvoicePage from './pages/Financeiro/F4CreateInvoicePage'
import F5MyInvoicesPage from './pages/Financeiro/F5MyInvoicesPage'
import PixPaymentPage from './pages/Financeiro/PixPaymentPage'
import { ForgotPassword } from './pages/ForgotPassword'
import LoginPage from './pages/LoginPage'
import MembersPage from './pages/Members/MembersPage'
import MatchDetailPage from './pages/MatchDetail/MatchDetailPage'
import N1Page from './pages/Notifications/N1Page'
import NotificationPreferencesPage from './pages/Settings/NotificationPreferencesPage'
import { OAuthCallback } from './pages/OAuthCallback'
import PL4MySubscriptionPage from './pages/Planos/PL4MySubscriptionPage'
import PL5ChangePlanPage from './pages/Planos/PL5ChangePlanPage'
import PlanoFormPage from './pages/Planos/PlanoFormPage'
import PlanosListPage from './pages/Planos/PlanosListPage'
import ProfilePage from './pages/Profile/ProfilePage'
import StoreCartPage from './pages/Loja/StoreCartPage'
import StoreCatalogPage from './pages/Loja/StoreCatalogPage'
import StoreCheckoutPage from './pages/Loja/StoreCheckoutPage'
import StoreOrderConfirmationPage from './pages/Loja/StoreOrderConfirmationPage'
import StoreOrdersPage from './pages/Loja/StoreOrdersPage'
import StoreProductPage from './pages/Loja/StoreProductPage'
import RankingsPage from './pages/Rankings/RankingsPage'
import ReportDetailPage from './pages/Reports/ReportDetailPage'
import ReportsHubPage from './pages/Reports/ReportsHubPage'
import { ResetPassword } from './pages/ResetPassword'
import RolesPage from './pages/Roles/RolesPage'
import S1Page from './pages/S1Page'
import TrocarArenaPage from './pages/TrocarArenaPage'
import SettingsPage from './pages/Settings/SettingsPage'
import { SignupPage } from './pages/SignupPage'
import NewStudentPage from './pages/Students/NewStudentPage'
import StudentProfilePage from './pages/Students/StudentProfilePage'
import MyEarningsPage from './pages/Teachers/MyEarningsPage'
import TeacherEarningsPage from './pages/Teachers/TeacherEarningsPage'
import TeacherFormPage from './pages/Teachers/TeacherFormPage'
import TeacherProfilePage from './pages/Teachers/TeacherProfilePage'
import TeachersListPage from './pages/Teachers/TeachersListPage'
import { TournamentViewPage } from './pages/TournamentView/TournamentViewPage'
import TournamentFormPage from './pages/Tournaments/TournamentFormPage'
import TournamentsListPage from './pages/Tournaments/TournamentsListPage'
import TO4RegisterPage from './pages/Torneios/TO4RegisterPage'
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

/** Atraso antes de disparar o fluxo de permissão de push depois de uma
 * sessão estabelecida (login, refresh no boot, refresh silencioso) — AC da
 * story (BEAC-1723/BEAC-2019/BEAC-2020): "disparado num momento
 * não-intrusivo... depois da primeira ação relevante do usuário, não no
 * carregamento da página". SESSION_ESTABLISHED_EVENT já garante que não é
 * o carregamento cru (só dispara pós-auth); o atraso adicional evita
 * competir com o primeiro render da tela pós-login. */
const PUSH_SETUP_DELAY_MS = 3000

/** BEAC-2019/BEAC-2020: dispara o fluxo de permissão + registro de push
 * (web ou nativo, ver src/lib/push.ts) toda vez que uma sessão é
 * estabelecida — cobre login, boot com sessão existente e qualquer refresh
 * silencioso (os 3 disparam SESSION_ESTABLISHED_EVENT, ver httpClient.ts).
 * setupPushNotifications() é idempotente (só faz POST /me/push-tokens se o
 * token mudou desde o último registro), então disparar de novo em todo
 * refresh silencioso é seguro. */
function usePushNotificationsSetup() {
  useEffect(() => {
    let timeoutId: number | undefined

    function handleSessionEstablished() {
      timeoutId = window.setTimeout(() => {
        void setupPushNotifications()
      }, PUSH_SETUP_DELAY_MS)
    }

    window.addEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
    return () => {
      window.removeEventListener(SESSION_ESTABLISHED_EVENT, handleSessionEstablished)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])
}

/** BEAC-2020: tap numa notificação nativa (app em background/fechado) —
 * PUSH_NOTIFICATION_TAPPED_EVENT carrega reference_type/reference_id (ver
 * src/lib/push.ts), resolvidos pra uma rota via
 * src/lib/notificationRouting.ts (mesma resolução usada pela N1Page pro tap
 * na lista). reference_type sem rota resolvível (gap estrutural documentado
 * em notificationRouting.ts) simplesmente não navega. */
function usePushNotificationDeepLink() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleTap(event: Event) {
      const detail = (event as CustomEvent<Record<string, string> | undefined>).detail
      const route = resolveNotificationRoute(detail?.reference_type, detail?.reference_id)
      if (route) navigate(route)
    }

    window.addEventListener(PUSH_NOTIFICATION_TAPPED_EVENT, handleTap)
    return () => window.removeEventListener(PUSH_NOTIFICATION_TAPPED_EVENT, handleTap)
  }, [navigate])
}

function AppRoutes() {
  useSessionExpiredRedirect()
  usePushNotificationsSetup()
  usePushNotificationDeepLink()

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
      <Route path="/trocar-arena" element={<TrocarArenaPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      {/* D3 — Dashboard Admin, parcial (BEAC-1893: só o card "Central de
          Pendências", ver comentário de pacote de DashboardPage.tsx e
          lib/dashboardTarget.ts). Unit-scoped porque o card precisa de um
          unitId no path — não existe mecanismo de "unit ativa" acessível
          no frontend fora de route params. */}
      <Route path="/units/:unitId/dashboard" element={<DashboardPage />} />
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
      {/* DU5 — Config Day Use (BEAC-1955, story BEAC-1712 "Toggle de Day Use
          por quadra em DU5"). Rota unit-scoped (não tenant-scoped): espelha
          o endpoint GET /units/{id}/day-use-configs (BEAC-1954), mesmo
          padrão de /units/:unitId/settings acima. Tela própria, FORA de
          /units/:unitId/settings (AC explícito — toast fixo na própria tela
          reforça isso). */}
      <Route path="/units/:unitId/day-use" element={<DayUseConfigPage />} />
      {/* DU6 — Reservas Day Use (BEAC-1966, story BEAC-1713 "Listagem de
          reservas Day Use com status de check-in"). Mesmo caminho que o
          botão "Ver reservas" de DU5 já navegava desde aquela task
          (DayUseConfigPage.tsx) — esta task só registra a rota de verdade,
          sem mexer no link existente. Rota unit-scoped, mesmo padrão de
          /units/:unitId/day-use acima: espelha GET
          /units/{id}/day-use-bookings (BEAC-1964). */}
      <Route path="/units/:unitId/day-use/reservas" element={<DayUseBookingsPage />} />
      {/* DU1/DU2/DU3 — Discovery / Detalhe / Confirmar de arena Day Use
          (BEAC-1960/1961/1962, story BEAC-1928 "Fluxo de reserva de Day Use
          para usuário"). Rotas DELIBERADAMENTE NÃO unit-scoped (sem :unitId
          no path de DU1): Day Use é cross-tenant (GET /day-use/discover não
          filtra por tenant do usuário logado, ver comentário de pacote em
          rallye-api/api/internal/dayuse/discover.go) — diferente de toda
          rota /units/:unitId/* acima. DU2/DU3 usam :unitId só porque É o
          alvo direto da consulta (GET /units/{id}/day-use-detail, POST
          /units/{id}/day-use-bookings), não porque a tela pertence à unit
          ativa do chamador. */}
      <Route path="/day-use" element={<DayUseDiscoveryPage />} />
      <Route path="/day-use/:unitId" element={<DayUseDetailPage />} />
      <Route path="/day-use/:unitId/confirm" element={<DayUseConfirmPage />} />
      {/* DU4 — QR Code de Acesso (BEAC-1963, mesma story). Rota SEM :unitId
          (unit-agnóstica de propósito): o backend (GET /day-use-bookings/
          {id}/qr, BEAC-1959) resolve a unit certa a partir só do id do
          booking — ver comentário de pacote em
          rallye-api/api/internal/dayuse/checkin.go. */}
      <Route path="/day-use-bookings/:bookingId" element={<DayUseQrPage />} />
      {/* AG1/AG2 — Calendário Dia/Semana (BEAC-1903, story BEAC-1704 "CRUD de
          turma com recorrência semanal"). Dois componentes deliberadamente
          separados (decisão travada do dispatch) — não uma variação de props
          de um só. Rota unit-scoped, mesmo padrão de /units/:unitId/roles. */}
      <Route path="/units/:unitId/agenda" element={<AG1DayPage />} />
      <Route path="/units/:unitId/agenda/semana" element={<AG2WeekPage />} />
      {/* AG3 — Minha agenda (Aluno) (BEAC-1926, mesma story). */}
      <Route path="/units/:unitId/agenda/minha" element={<AG3StudentAgendaPage />} />
      {/* AG4 — Minha Agenda (Professor). Buraco de planejamento do Épico 6
          (Agendamento, já Done) — a descrição do épico cita esta tela no
          escopo, mas nenhuma story/task específica chegou a ser criada.
          Construída sem story/task no Allye, por pedido direto do usuário
          (ver AG4TeacherAgendaPage.tsx para o relatório completo). Mesmo
          padrão de rota unit-scoped das demais telas de agenda — o :unitId
          é só convenção de URL, o componente busca cross-arena (ver
          comentário de pacote do componente). */}
      <Route path="/units/:unitId/agenda/professor" element={<AG4TeacherAgendaPage />} />
      {/* AG5 — Detalhe da Aula/Reserva, base only (BEAC-1905, mesma story).
          AG1DayPage/AG2WeekPage navegam pra cá passando o Booking já
          carregado via router state (ver comentário de pacote de
          AG5BookingDetailPage.tsx — sem GET /bookings/{id} para deep link
          direto). */}
      <Route path="/units/:unitId/bookings/:bookingId" element={<AG5BookingDetailPage />} />
      {/* Agendar aula (Aluno) — fluxo self-service NOVO (não reskin),
          construído do zero seguindo Figma "06/07/08 · Agendar — Escolher
          Horário/Confirmar/Sucesso — Aluno" (nodes 159:1576/183:2954,
          159:1618/183:2973, 159:1660/183:2992). Integrado com o backend real
          de disponibilidade/reserva por ocorrência (GET/POST
          .../classes/occurrences, ../lib/api/classOccurrences.ts) e linkado
          ao botão "Agendar aula" de AG3StudentAgendaPage.tsx. */}
      <Route path="/units/:unitId/agenda/agendar" element={<AgendarEscolherHorarioPage />} />
      <Route path="/units/:unitId/agenda/agendar/confirmar" element={<AgendarConfirmarPage />} />
      <Route path="/units/:unitId/agenda/agendar/sucesso" element={<AgendarSucessoPage />} />
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
      {/* PL1/PL2 — Catálogo de Planos / Criar-editar Plano (BEAC-1934/1935,
          story BEAC-1927 "Planos e Assinaturas"). Rotas unit-scoped, mesmo
          padrão de /units/:unitId/classes(/:classId) acima. "new" (criação)
          é um segmento estático que casa ANTES de :planId (dinâmico, edição)
          — mesma prioridade de rota já usada em
          /units/:unitId/teachers/new vs /teachers/:teacherId abaixo. */}
      <Route path="/units/:unitId/plans" element={<PlanosListPage />} />
      <Route path="/units/:unitId/plans/new" element={<PlanoFormPage />} />
      <Route path="/units/:unitId/plans/:planId" element={<PlanoFormPage />} />
      {/* PL4 — Minha Assinatura (Aluno) (BEAC-1937, mesma story). Padrão
          "my-X" (não "/plans/*", que é o namespace de catálogo do Admin) —
          espelha /units/:unitId/my-invoices (F5MyInvoicesPage) abaixo, a
          tela irmã mais próxima em natureza (financeiro, self-service).
          PL5 — Upgrade/Downgrade de Plano (BEAC-1938, mesma story) é o
          destino do botão [TROCAR PLANO] de PL4, na mesma sub-rota
          "/change-plan" já referenciada por PL4MySubscriptionPage.tsx antes
          desta task existir (o gap ficou documentado lá até agora). */}
      <Route path="/units/:unitId/my-subscription" element={<PL4MySubscriptionPage />} />
      <Route path="/units/:unitId/my-subscription/change-plan" element={<PL5ChangePlanPage />} />
      {/* PR1/PR2 — Lista de professores / Perfil do professor (BEAC-1880,
          épico 5). Rotas unit-scoped, mesmo padrão de
          /units/:unitId/classes(/:classId) acima. */}
      <Route path="/units/:unitId/teachers" element={<TeachersListPage />} />
      {/* PR3 — Cadastro/Edição de Professor (BEAC-1875, mesma story). Mesmo
          componente para os dois modos (TeacherFormPage deriva o modo da
          presença de :teacherId no path) — segmentos literais "new"/"edit"
          casam antes do :teacherId dinâmico (mesma prioridade de rota
          estática > dinâmica de react-router v6 já documentada em
          /units/:unitId/students/new). */}
      <Route path="/units/:unitId/teachers/new" element={<TeacherFormPage />} />
      <Route path="/units/:unitId/teachers/:teacherId/edit" element={<TeacherFormPage />} />
      <Route path="/units/:unitId/teachers/:teacherId" element={<TeacherProfilePage />} />
      {/* PR4 — Meus Ganhos (BEAC-1700/BEAC-1884, feature BEAC-1635 wave 1).
          Sem PF2 nesta base ainda (comment de pacote em
          TeacherEarningsPage.tsx) — alcançada hoje via o botão "Ver como o
          professor vê" da aba Comissão de PR2. */}
      <Route path="/units/:unitId/teachers/:teacherId/earnings" element={<TeacherEarningsPage />} />
      {/* Meus Ganhos — self-view (BEAC-2095, story BEAC-2051). Mesma fonte
          de dados/apresentação de PR4 (EarningsSummary compartilhado),
          escopada ao próprio professor via GET /me — atalho a partir do
          D2Dashboard. `:unitId` é só cosmético (ver MyEarningsPage.tsx). */}
      <Route path="/units/:unitId/me/earnings" element={<MyEarningsPage />} />
      {/* F7 — hub de Relatórios Financeiros + detalhe (BEAC-1968, story
          BEAC-1714). Rotas unit-scoped, mesmo padrão de
          /units/:unitId/teachers(/:teacherId) acima — segmento literal
          ":type" do detalhe é o slug do relatório (ex.: "receita-por-
          professor"), validado contra REPORT_CATALOG dentro da própria
          página (tipo desconhecido -> mensagem de erro, não 404 de rota). */}
      <Route path="/units/:unitId/reports" element={<ReportsHubPage />} />
      <Route path="/units/:unitId/reports/:type" element={<ReportDetailPage />} />
      {/* F1-F5 — Financeiro (BEAC-1946/1947/1948/1949/1950, story BEAC-1710
          "Modelo unificado de fatura"). Rotas unit-scoped, mesmo padrão de
          /units/:unitId/plans(/:planId) acima — "new" (F4, criação) casa
          ANTES de qualquer segmento dinâmico, mesma prioridade estática >
          dinâmica já documentada em /units/:unitId/teachers/new.
          /invoices/:invoiceId (F3) NÃO é unit-scoped — espelha
          GET /invoices/{id} (BEAC-1944), que resolve a unit da SESSÃO do
          chamador, não do path (mesmo padrão de /teachers/:teacherId vs.
          rotas unit-scoped irmãs). */}
      <Route path="/units/:unitId/cashflow" element={<F1CashFlowPage />} />
      <Route path="/units/:unitId/invoices" element={<F2InvoiceListPage />} />
      <Route path="/units/:unitId/invoices/new" element={<F4CreateInvoicePage />} />
      <Route path="/units/:unitId/my-invoices" element={<F5MyInvoicesPage />} />
      <Route path="/invoices/:invoiceId" element={<F3InvoiceDetailPage />} />
      {/* 13 — Pagamento PIX (Aluno), Figma 164:4669/186:2208 (+ erro 187:7119).
          Filha de /invoices/:invoiceId e NÃO unit-scoped pelo mesmo motivo que
          F3: POST /invoices/{id}/payments/pix e GET /payments/{id} resolvem a
          unit da SESSÃO do chamador, não do path. Alcançada pelo CTA "Pagar
          agora" da visão Aluno em F3 — ver o JSDoc de PixPaymentPage.tsx para
          por que esse CTA deixou de abrir o `payment_link`. */}
      <Route path="/invoices/:invoiceId/pix" element={<PixPaymentPage />} />
      {/* 15 — Bloqueado por Inadimplência (Aluno), Figma 165:4803/186:2246.
          Unit-scoped como F5 (a tela lê GET /units/{id}/invoices?status=
          atrasada). Alcançada quando um fluxo self-service recebe o 403
          `delinquency_blocked` do backend — hoje só DU3
          (DayUseConfirmPage.tsx), ver o comentário de pacote da página. */}
      <Route path="/units/:unitId/blocked" element={<BlockedByDelinquencyPage />} />
      {/* TO1 — Lista de Torneios (BEAC-1984, story BEAC-1716), destravada
          pela BEAC-2013 (GET /units/{id}/tournaments?scope=..., o endpoint
          de listagem que não existia quando TO2/TO3 foram construídas — ver
          comentário de pacote de TournamentsListPage.tsx). Precisa vir
          ANTES de /units/:unitId/tournaments/new na leitura, mas react-router
          resolve por segmento estático vs. dinâmico, não por ordem — sem
          ambiguidade real entre as duas (mesma prioridade já documentada em
          /units/:unitId/teachers/new vs /teachers/:teacherId). */}
      <Route path="/units/:unitId/tournaments" element={<TournamentsListPage />} />
      {/* TO2 — Criar Torneio (BEAC-1985, story BEAC-1716). Rota unit-scoped,
          mesmo padrão de /units/:unitId/plans/new: criar exige a unit (POST
          /units/{id}/tournaments). O back link de TournamentFormPage e o
          "Criar" de TO1 acima apontam pra cá. */}
      <Route path="/units/:unitId/tournaments/new" element={<TournamentFormPage />} />
      {/* A5 — Magic link de visitante de torneio (BEAC-1817). */}
      <Route path="/tournaments/:tournamentId/visitor" element={<VisitorRequestPage />} />
      <Route path="/tournaments/:tournamentId/visitor/verify" element={<VisitorVerifyPage />} />
      {/* TO4 — Inscrição em torneio (BEAC-1990, story BEAC-1717 — "Sugestão de
          categoria com base no nível de habilidade"). Chegada natural do
          botão "Inscrever-se" de TO3 (BEAC-1718, feature em paralelo) —
          rota unit-agnóstica, mesmo padrão de /tournaments/:tournamentId
          acima: `{tournamentId}` já resolve tudo que a tela precisa (torneio
          + categorias via GET /tournaments/{id}), sem exigir :unitId no
          path. */}
      <Route path="/tournaments/:tournamentId/register" element={<TO4RegisterPage />} />
      {/* TO5 — Chaves/Bracket (BEAC-2006, story BEAC-1719). Rota já referenciada
          pelo link "Ver chaves" da aba Chaves de TO3 (TournamentViewPage,
          feature em paralelo). Um segmento a mais que
          /tournaments/:tournamentId abaixo — sem ambiguidade de match entre
          os dois, react-router resolve por profundidade de path, não por
          ordem de declaração aqui. */}
      <Route path="/tournaments/:tournamentId/bracket" element={<BracketPage />} />
      {/* TO6 — Detalhe da Partida (BEAC-2007, story BEAC-1719). Chegada
          natural do tap num match card de TO5 (BracketPage acima). */}
      <Route path="/tournaments/:tournamentId/matches/:matchId" element={<MatchDetailPage />} />
      <Route path="/tournaments/:tournamentId" element={<TournamentViewPage />} />
      {/* TO8 — Rankings (BEAC-2009, story BEAC-1719). Rota de nível superior
          (não aninhada em /tournaments/:id): o ranking agrega vários
          torneios via GET /rankings (Épico 4, BEAC-1855), não pertence a
          um torneio específico. */}
      <Route path="/rankings" element={<RankingsPage />} />
      {/* Loja da Arena — telas 22/22b (catálogo), 23 (detalhe) e 24
          (carrinho). A assimetria de escopo entre elas é a do backend, não
          uma inconsistência: o CATÁLOGO é unit-scoped porque é a arena do
          path que posiciona a RLS (e o detalhe carrega :unitId pelo mesmo
          motivo — não há como resolver a arena a partir do id do produto),
          enquanto o CARRINHO é objeto do usuário e atravessa arenas
          (`GET /me/store/cart` devolve os itens de TODAS as arenas,
          agrupados). Uma rota de carrinho com :unitId prometeria um recorte
          por arena que o backend não tem. Ver src/pages/Loja/routes.ts.

          O CHECKOUT (25) leva :unitId porque `POST /me/store/orders` fecha o
          grupo de UMA arena e devolve o resto do carrinho intacto — a arena é
          o argumento da operação, não o contexto. Já PEDIDOS (26/27) não
          levam arena nenhuma: `GET /me/store/orders` atravessa arenas, como o
          carrinho. As três moram sob /store/… e não sob /units/:id/store/…
          porque o recurso é `/me/…`. */}
      <Route path="/units/:unitId/store" element={<StoreCatalogPage />} />
      <Route path="/units/:unitId/store/products/:productId" element={<StoreProductPage />} />
      <Route path="/store/cart" element={<StoreCartPage />} />
      <Route path="/store/checkout/:unitId" element={<StoreCheckoutPage />} />
      <Route path="/store/orders" element={<StoreOrdersPage />} />
      <Route path="/store/orders/:orderId" element={<StoreOrderConfirmationPage />} />
      {/* N1 — Centro de Notificações (BEAC-2021, story BEAC-1723). Rota de
          nível superior (não unit-scoped, mesmo padrão de /perfil): o sino no
          topbar de AppShell.tsx alcança daqui de qualquer tela, e GET
          /me/notifications (BEAC-2018) é escopado só por usuário. */}
      <Route path="/notificacoes" element={<N1Page />} />
      {/* PF5 — Configurações, seção mínima "Notificações" (BEAC-2035, story
          BEAC-1727). Escopo mínimo documentado em SettingsPage.tsx — só a
          seção de canais de notificação, não a tela PF5 inteira do
          protótipo. Alcançável a partir de ProfilePage.tsx
          ("Configurações"). */}
      <Route path="/configuracoes" element={<SettingsPage />} />
      {/* PF6 — Preferências de Notificação (BEAC-2034, story BEAC-1727).
          Rota de nível superior (mesmo padrão de /notificacoes/perfil): as
          preferências são escopadas só por usuário (self_access), sem
          unit/tenant ativo necessário. Alcançada a partir de PF5
          (/configuracoes, "Gerenciar preferências por evento →"). */}
      <Route path="/configuracoes/notificacoes" element={<NotificationPreferencesPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function App() {
  return (
    // QueryClientProvider é o wrapper MAIS EXTERNO — acima até do
    // ThemeProvider — porque o PermissionsProvider abaixo já depende dele
    // (as permissions agora são uma query, ver context/PermissionsContext.tsx)
    // e porque nada na árvore deve ficar fora do alcance do cache: a mesma
    // convenção de "o provider global envolve tudo" que ThemeProvider e
    // PermissionsProvider já seguem. Ver lib/query/queryClient.ts para os
    // defaults de staleTime/gcTime e o porquê deles.
    <QueryClientProvider client={appQueryClient}>
      {/* ThemeProvider (BEAC-2065) envolve TODA a árvore, inclusive fora de
          BrowserRouter: ThemeToggle precisa alcançar rotas públicas (login,
          signup) que ficam fora do AppShell autenticado, então não pode viver
          dentro de PermissionsProvider nem de AppRoutes. */}
      <ThemeProvider>
        <ThemeToggle />
        <BrowserRouter>
          {/* PermissionsProvider (BEAC-1841) precisa envolver toda a árvore de
              rotas autenticadas: usePermission é o mecanismo de UI de permissão
              do qual todo outro épico/feature depende, então nenhuma tela pode
              ficar fora do seu alcance. */}
          <PermissionsProvider>
            <AppRoutes />
          </PermissionsProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
