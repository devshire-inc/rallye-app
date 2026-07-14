import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom'
import { SESSION_EXPIRED_EVENT } from './lib/httpClient'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import S1Page from './pages/S1Page'

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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/s1" element={<S1Page />} />
      <Route path="/dashboard" element={<DashboardPage />} />
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
