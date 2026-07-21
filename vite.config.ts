/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fixa o timezone dos testes em America/Sao_Paulo (mesmo fuso assumido
    // em todo o app/backend, ex. unitTimezone no rallye-api) — sem isso,
    // testes que formatam horário no fuso LOCAL do processo passam em
    // máquinas de dev (BRT) mas quebram em runners de CI (UTC), como
    // aconteceu em RemarcarSheet.test.tsx.
    env: {
      TZ: 'America/Sao_Paulo',
    },
  },
})
