# rallye-app

Frontend do Rallye — app de gestão de arenas esportivas (beach tennis, padel, futevôlei, vôlei) — escrito em **React + Vite + TypeScript**, empacotado com **Capacitor** para gerar os apps nativos iOS e Android a partir da mesma base de código web.

## Stack

- React + TypeScript + Vite (build e dev server).
- Capacitor (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`) para empacotamento nativo.
- Gerenciador de pacotes: [bun](https://bun.sh).

## Estrutura do repositório

```
rallye-app/
├── src/            # Código-fonte React (componentes, hooks, páginas, estilos)
├── public/         # Assets estáticos servidos pelo Vite
├── ios/            # Projeto nativo Xcode gerado pelo Capacitor (versionado — ver nota abaixo)
├── android/        # Projeto nativo Android gerado pelo Capacitor (versionado — ver nota abaixo)
├── capacitor.config.ts
└── .github/        # Workflows de CI/CD
```

### Por que `ios/` e `android/` são versionados

Seguindo a recomendação oficial do Capacitor, os projetos nativos gerados por `cap add` são commitados no repositório (não regenerados a cada build), pois frequentemente recebem customizações manuais (permissões, ícones, splash screen, configuração de assinatura). Apenas artefatos de build/dependências nativas (`Pods/`, `build/`, `.gradle/`) são ignorados — veja `.gitignore`.

## Relação com o rallye-api

`rallye-app` e `rallye-api` são repositórios independentes (multi-repo). Este repositório consome o contrato HTTP exposto pelo `rallye-api`. Mudanças de contrato de API devem ser versionadas e comunicadas entre os dois repositórios.

## Ambientes

- `develop` → deploy automático em **hml** (build web em hml + builds Capacitor de teste).
- `main` → deploy automático em **prod** (ativado apenas ao final do MVP + publicação nas lojas de app), protegida por branch protection (PR revisado e aprovado é o único gate humano do pipeline).

## Comandos locais

```bash
bun install       # instala dependências
bun run dev       # dev server Vite
bun run build     # build de produção (gera dist/)
bunx cap sync     # sincroniza dist/ com os projetos nativos ios/android
```

## Setup local

Veja `docs/local-setup.md` (raiz do monorepo de documentação) ou o guia unificado referenciado na feature BEAC-1614.
