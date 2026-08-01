import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryTestProvider } from './queryTestClient'

/**
 * `render` do @testing-library com um QueryClient por volta — substituto
 * direto para os testes que renderizam uma página com `useShellIdentity`/
 * `useMe` (ou que montam o `PermissionsProvider` eles mesmos) mas não passam
 * por ./renderWithPermissions.tsx, que já embute os dois.
 *
 * Arquivo separado de ./queryTestClient.tsx (que só exporta o componente)
 * por causa do eslint react-refresh/only-export-components.
 */
export function renderWithQuery(ui: ReactElement): RenderResult {
  return render(<QueryTestProvider>{ui}</QueryTestProvider>)
}
