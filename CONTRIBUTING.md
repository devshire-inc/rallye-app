# Contribuindo

Convenções compartilhadas entre `rallye-api` e `rallye-app`.

## Branches

- `main` — produção. Protegida: só aceita merge via PR revisado e aprovado (branch protection).
- `develop` — homologação (hml). Todo trabalho novo nasce a partir dela.
- Branches de trabalho: `feature/<escopo-curto>`, `fix/<escopo-curto>`, `chore/<escopo-curto>`, abertas a partir de `develop` e mergeadas de volta nela via PR.

## Commits — Conventional Commits

Formato: `<tipo>(<escopo opcional>): <descrição curta no imperativo>`

Tipos usados:

| Tipo       | Uso                                                         |
|------------|--------------------------------------------------------------|
| `feat`     | Nova funcionalidade                                          |
| `fix`      | Correção de bug                                               |
| `chore`    | Tarefas de manutenção, configuração, dependências             |
| `docs`     | Apenas documentação                                           |
| `refactor` | Mudança de código sem alterar comportamento externo           |
| `test`     | Adição/ajuste de testes                                       |
| `ci`       | Mudanças em pipelines de CI/CD                                |

Exemplos:

```
feat(auth): adicionar login via magic-link
fix(agenda): corrigir cálculo de crédito de reagendamento
chore: configurar golangci-lint
docs: documentar setup de ambiente local
```

## Pull Requests

- PR para `main` exige ao menos 1 aprovação e todos os checks de CI verdes (branch protection).
- PR para `develop` deve passar no pipeline de CI (lint + test + build) antes do merge.
- Título do PR segue a mesma convenção de commit (ex.: `feat(financeiro): implementar estorno de Day Use`).
