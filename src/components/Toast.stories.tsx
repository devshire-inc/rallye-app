import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './ui/Button/Button'
import { Toast } from './Toast'
import './Toast.stories.css'

const meta = {
  title: 'Toast',
  component: Toast,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'radio', options: ['success', 'warning', 'danger', 'info'] },
    layout: { control: 'radio', options: [undefined, 'mobile', 'desktop'] },
    message: { control: 'text' },
  },
  args: {
    message: 'Reserva confirmada com sucesso!',
    tone: 'success',
    onDismiss: () => {},
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Trigger real: o botão dispara o toast via useState de verdade — fechar
 * pelo botão ✕ (ou clicar em "Desfazer", quando HasAction) some com ele de
 * fato, não só o Control. Duração mínima de 5s (doc Figma 239:546) é
 * simulada aqui via setTimeout — quem consome o Toast decide o timer real.
 */
export const Playground: Story = {
  argTypes: {
    action: { control: false },
  },
  render: (args) => {
    const [visible, setVisible] = useState(false)
    const [withAction, setWithAction] = useState(false)
    const [lastAction, setLastAction] = useState<string | null>(null)

    const trigger = () => {
      setLastAction(null)
      setVisible(true)
    }

    return (
      <div style={{ padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button onClick={trigger}>Disparar toast</Button>
        <Button variant="secondary" onClick={() => setWithAction((v) => !v)}>
          {withAction ? 'Com ação (Desfazer)' : 'Sem ação'}
        </Button>
        <p style={{ marginTop: 'var(--space-3)', font: 'var(--type-small)', color: 'var(--text-muted)' }}>
          {lastAction ? `Ação clicada: ${lastAction}` : visible ? 'Toast visível.' : 'Toast fechado.'}
        </p>
        {visible && (
          <Toast
            {...args}
            onDismiss={() => setVisible(false)}
            action={withAction ? { label: 'Desfazer', onClick: () => setLastAction('Desfazer') } : undefined}
          />
        )}
      </div>
    )
  },
}

/** Compat: caller antigo usando só `variant` (sem `tone`) continua igual —
 * `variant="error"` mapeia para tone danger internamente. */
export const LegacyVariant: Story = {
  render: () => {
    const [visible, setVisible] = useState(false)
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Button onClick={() => setVisible(true)}>Disparar toast (variant="error")</Button>
        {visible && <Toast message="Não foi possível concluir o pagamento." variant="error" onDismiss={() => setVisible(false)} />}
      </div>
    )
  },
}

/** Grade Tone x HasAction (Mobile) — espelha o frame de variantes "Toast"
 * (node 194:3) do Figma; Desktop muda só a largura via `layout="desktop"`. */
export const States: Story = {
  render: () => (
    <div className="toast-story-grid" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)', background: 'var(--surface-page)' }}>
      {(['success', 'warning', 'danger', 'info'] as const).map((tone) => (
        <div key={tone} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Toast message="Reserva confirmada com sucesso!" tone={tone} layout="mobile" onDismiss={() => {}} />
          <Toast
            message="Não foi possível concluir o pagamento."
            tone={tone}
            layout="mobile"
            action={{ label: 'Tentar de novo', onClick: () => {} }}
            onDismiss={() => {}}
          />
        </div>
      ))}
    </div>
  ),
}
