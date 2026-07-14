import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { LoginPage } from './pages/Login/LoginPage'
import { SignupPage } from './pages/Signup/SignupPage'
import { TournamentViewPage } from './pages/TournamentView/TournamentViewPage'
import { VerifyEmailPage } from './pages/VerifyEmail/VerifyEmailPage'
import { VisitorRequestPage } from './pages/VisitorRequest/VisitorRequestPage'
import { VisitorVerifyPage } from './pages/VisitorVerify/VisitorVerifyPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/tournaments/:tournamentId/visitor" element={<VisitorRequestPage />} />
        <Route path="/tournaments/:tournamentId/visitor/verify" element={<VisitorVerifyPage />} />
        <Route path="/tournaments/:tournamentId" element={<TournamentViewPage />} />
        <Route path="/" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    </Router>
  )
}

export default App
