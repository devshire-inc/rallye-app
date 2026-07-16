import { useState } from 'react'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { BottomSheet } from '../components/BottomSheet/BottomSheet'
import { EnterArenaSheet } from '../components/EnterArenaSheet/EnterArenaSheet'
import LogoutButton from '../components/LogoutButton'

/**
 * Placeholder da tela S1 (seleção de membership quando o usuário pertence a
 * 2+ organizações). A tela em si é de outra story/épico — este componente
 * existe apenas como alvo de redirecionamento pós-login para a story
 * BEAC-1674. Usa o mesmo shell visual "Horizon" das telas de auth, sem a
 * grade de arenas real (fora do escopo desta story — Épico 3).
 *
 * O botão/sheet "Entrar em nova arena" (BEAC-1808) é conectado aqui como um
 * gatilho temporário: a S1 real (BEAC-1623) ainda não existe, então não há
 * lista para atualizar após o sucesso — só fechamos o sheet e confirmamos
 * inline. Quando a S1 real existir, o mesmo EnterArenaSheet (e seu callback
 * onSuccess) deve ser reaproveitado lá, disparando um refresh da lista real.
 */
export default function S1Page() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function handleInviteRedeemed() {
    setSheetOpen(false)
    setConfirmation('Você entrou na arena!')
  }

  return (
    <main>
      <AuthLayout
        title="Selecione uma organização (S1)"
        subtitle="Você faz parte destas arenas — toque para entrar."
        mark="sm"
      >
        <LogoutButton />

        <button type="button" className="btn btn-secondary btn-md" onClick={() => setSheetOpen(true)}>
          Entrar em nova arena
        </button>

        {confirmation && (
          <p
            role="status"
            style={{
              background: 'var(--success-bg)',
              color: 'var(--success-fg)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-input)',
              fontSize: '13px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            {confirmation}
          </p>
        )}
      </AuthLayout>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Entrar em nova arena">
        <EnterArenaSheet onSuccess={handleInviteRedeemed} />
      </BottomSheet>
    </main>
  )
}
