import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupQueryPlatformBridge } from './lib/query/platformBridge'
import { applyInitialTheme } from './lib/theme'
import './index.css'
import App from './App.tsx'

applyInitialTheme()
// Liga foco/conectividade do react-query aos eventos nativos do Capacitor.
// No build web é um no-op (ver o módulo) — mesma postura de "efeito global de
// boot, uma vez, antes do render" já usada por applyInitialTheme acima.
setupQueryPlatformBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
