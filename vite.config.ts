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
// Proxy de desenvolvimento: permite rodar o front local contra uma rallye-api
// remota (ex.: hml) sem esbarrar em CORS. O backend só libera a origem do seu
// próprio ambiente (CORS_ALLOWED_ORIGIN), então uma chamada direta de
// localhost:5173 é bloqueada pelo navegador. Com o proxy, o browser fala só com
// localhost (mesma origem) e o Vite repassa server-side, onde CORS não se aplica.
//
// Uso: no .env, deixe VITE_API_BASE_URL vazio (caminho relativo) e aponte
// DEV_API_PROXY_TARGET para a API desejada. Sem DEV_API_PROXY_TARGET, nada muda
// e o app fala direto com VITE_API_BASE_URL, como sempre.
//
// Os prefixos abaixo são as rotas de topo servidas pela rallye-api
// (api/cmd/server/main.go). Só precisa mexer aqui se o backend ganhar um
// prefixo de topo novo.
const API_ROUTE_PREFIXES = [
  'auth', 'me', 'units', 'tenants', 'bookings', 'classes', 'courts', 'students',
  'teachers', 'teacher-block-requests', 'invoices', 'invites', 'plans',
  'subscriptions', 'rankings', 'reschedule-credits', 'waitlist', 'day-use',
  'day-use-bookings', 'tournaments', 'tournament-categories',
  'tournament-matches', 'tournament-registrations',
];

const devApiTarget = process.env.DEV_API_PROXY_TARGET;

const devProxy = devApiTarget
  ? Object.fromEntries(
      API_ROUTE_PREFIXES.map((prefix) => [
        `/${prefix}`,
        {
          target: devApiTarget,
          changeOrigin: true,
          secure: true,
          // O cookie de sessão vem com Domain do host remoto; sem reescrever,
          // o navegador descarta em localhost e a sessão nunca persiste.
          cookieDomainRewrite: '',
        },
      ]),
    )
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    // Loopback IPv4 explícito. Por padrão o Vite sobe só em [::1] (loopback
    // IPv6); quem acessa esta VPS por túnel SSH encaminhando 127.0.0.1:5173
    // não encontra nada escutando ali e a conexão falha.
    //
    // Deliberadamente '127.0.0.1' e não `true`/'0.0.0.0': `true` faria bind em
    // todas as interfaces, deixando o dev server (código-fonte + HMR) acessível
    // pelo IP público da VPS caso o firewall falhe ou seja reconfigurado.
    // '127.0.0.1' cobre exatamente o que o túnel precisa e não depende do
    // firewall para não ficar exposto — defesa em camadas.
    host: '127.0.0.1',
    proxy: devProxy,
  },
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