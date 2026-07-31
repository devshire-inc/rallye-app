/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  build: {
    // cssMinify desabilitado: lightningcss 1.32/1.33 (o minificador padrão
    // do Vite) lança "Unexpected end of input" ao minificar o CSS
    // concatenado de produção depois que ele passou de ~170KB (cruzado no
    // Épico 10, BEAC-1724 — confirmado via bisect, não é erro de sintaxe
    // em nenhum arquivo .css, reproduz até com CSS válido trivial no fim
    // do bundle). Sem fix upstream disponível nas versões testadas.
    // Custo: bundle CSS ~90KB maior (gzip ~15KB maior) até isso ser
    // corrigido no lightningcss/Vite — revisar quando atualizarem.
    cssMinify: false
  },
  test: {
    projects: [{
      extends: true,
      test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        // Fixa o timezone dos testes em America/Sao_Paulo (mesmo fuso assumido
        // em todo o app/backend, ex. unitTimezone no rallye-api) — sem isso,
        // testes que formatam horário no fuso LOCAL do processo passam em
        // máquinas de dev (BRT) mas quebram em runners de CI (UTC), como
        // aconteceu em RemarcarSheet.test.tsx.
        env: {
          TZ: 'America/Sao_Paulo'
        }
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});