import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { CadastroPage } from './pages/cadastro/CadastroPage'
import { LoginPage } from './pages/login/LoginPage'
import { VerificacaoEmailPage } from './pages/verificacao-email/VerificacaoEmailPage'

// Cadastro (A2) é a primeira tela real do app e é pré-RBAC: acessível sem
// nenhum papel. "/" redireciona para "/cadastro" até existir uma tela A1 de
// login "de fato" para decidir a rota raiz (fora de escopo desta story).
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cadastro" replace />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/verificacao-email" element={<VerificacaoEmailPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
