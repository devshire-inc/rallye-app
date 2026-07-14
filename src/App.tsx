import { LoginPage } from './pages/LoginPage'
import { OAuthCallback } from './pages/OAuthCallback'
import { SignupPage } from './pages/SignupPage'
import './App.css'

// Decisão técnica (BEAC-1816, documentar no PR): o projeto ainda não tem
// nenhuma biblioteca de rotas instalada (nenhuma story anterior a
// introduziu). Em vez de adicionar uma dependência de roteamento inteira só
// para três telas de auth — decisão maior de arquitetura que caberia à
// story que criar a navegação real do app (provavelmente BEAC-1673/1674/1788)
// — este componente faz um roteamento mínimo baseado em `window.location.pathname`,
// suficiente para exercitar o fluxo OAuth ponta a ponta manualmente. Quando
// uma lib de rotas for adotada, estas três páginas (LoginPage, SignupPage,
// OAuthCallback) devem ser penduradas nela sem precisar mudar de implementação.
//
// /oauth/callback é mantida só por retrocompatibilidade (ver
// pages/OAuthCallback.tsx) — desde a correção de arquitetura de BEAC-1815,
// o backend redireciona sucesso/falha direto para /dashboard ou /login.
function App() {
  const path = window.location.pathname

  if (path === '/oauth/callback') {
    return <OAuthCallback />
  }

  if (path === '/signup') {
    return <SignupPage />
  }

  return <LoginPage />
}

export default App
