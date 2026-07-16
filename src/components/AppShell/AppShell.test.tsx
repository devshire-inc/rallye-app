import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <AppShell orgLabel="Rede Areia Dourada" userLabel="Dono">
              conteúdo
            </AppShell>
          }
        />
        <Route path="/s1" element={<div>S1 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Timers reais — ver comentário equivalente em AuthLayout.test.tsx.
describe('AppShell long-press logo (BEAC-1835)', () => {
  it('navigates to /s1 when the sidebar brand mark is held past the long-press delay', async () => {
    const { container } = renderShell()
    const mark = container.querySelector('.brand-mark') as HTMLElement

    fireEvent.pointerDown(mark)

    await waitFor(() => expect(screen.getByText('S1 placeholder')).toBeInTheDocument(), {
      timeout: 1500,
    })
  })

  it('does nothing on a short tap of the brand mark', async () => {
    const { container } = renderShell()
    const mark = container.querySelector('.brand-mark') as HTMLElement

    fireEvent.pointerDown(mark)
    fireEvent.pointerUp(mark)

    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.queryByText('S1 placeholder')).not.toBeInTheDocument()
  })
})
