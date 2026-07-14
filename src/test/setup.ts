import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// @testing-library/react não limpa o DOM entre testes automaticamente a menos
// que os globals do Vitest estejam habilitados (não estão neste projeto —
// vite.config.ts não define test.globals). Sem isso, renders de testes
// anteriores no mesmo arquivo permanecem no DOM e quebram queries por role
// texto (ex.: múltiplos botões "Criar minha conta" encontrados).
afterEach(() => {
  cleanup()
})
