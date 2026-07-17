import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom'
import { SESSION_EXPIRED_EVENT } from './lib/httpClient'
import { CadastroPage } from './pages/cadastro/CadastroPage'
import DashboardPage from './pages/DashboardPage'
import { ForgotPassword } from './pages/ForgotPassword'
import LoginPage from './pages/LoginPage'
import MembersPage from './pages/Members/MembersPage'
import { OAuthCallback } from './pages/OAuthCallback'
import ProfilePage from './pages/Profile/ProfilePage'
import { ResetPassword } from './pages/ResetPassword'
import S1Page from './pages/S1Page'
import { SignupPage } from './pages/SignupPage'
import { TournamentViewPage } from './pages/TournamentView/TournamentViewPage'
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
      <Route path="/tenants/:tenantId/units" element={<UnitsPage />} />
      <Route path="/tenants/:tenantId/units/new" element={<NewUnitPage />} />
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
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
