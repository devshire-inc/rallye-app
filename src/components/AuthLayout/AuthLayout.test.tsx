import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<AuthLayout title="Entrar">conteúdo</AuthLayout>} />
        <Route path="/s1" element={<div>S1 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Timers reais (não vi.useFakeTimers): o setTimeout de useLongPress dispara
// `navigate`, cujo efeito no DOM precisa passar por um flush real do React —
// avançar um fake timer fora de um `act()` async deixava a asserção instável
// (o navigate acontecia mas o DOM não tinha sido re-renderizado ainda no
// mesmo tick síncrono). `waitFor` faz polling com timers reais até o texto
// aparecer, então 600ms reais de espera é aceitável aqui.
describe('AuthLayout long-press logo (BEAC-1835)', () => {
  it('navigates to /s1 when the rallye. mark is held past the long-press delay', async () => {
    const { container } = renderLayout()
    const mark = container.querySelector('.hz-mark') as HTMLElement

    fireEvent.pointerDown(mark)

    await waitFor(() => expect(screen.getByText('S1 placeholder')).toBeInTheDocument(), {
      timeout: 1500,
    })
  })

  it('does nothing on a short tap of the mark', async () => {
    const { container } = renderLayout()
    const mark = container.querySelector('.hz-mark') as HTMLElement

    fireEvent.pointerDown(mark)
    fireEvent.pointerUp(mark)

    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.queryByText('S1 placeholder')).not.toBeInTheDocument()
  })
})
