import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// O projeto não usa `globals: true` no Vitest (importa describe/it/expect
// explicitamente), então o auto-cleanup do Testing Library não é registrado
// implicitamente — precisa ser feito aqui, senão o DOM de um teste vaza para
// o próximo dentro do mesmo arquivo.
afterEach(() => {
  cleanup()
})
