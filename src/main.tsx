import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyInitialTheme } from './lib/theme'
import './index.css'
import App from './App.tsx'

applyInitialTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
