import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button/Button'
import { Modal } from './Modal'
import './Modal.stories.css'

const meta = {
  title: 'ui/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    closeOnScrimClick: { control: 'boolean' },
  },
  args: {
    title: 'Confirmar cancelamento',
    open: false,
    onClose: () => {},
    size: 'md',
    closeOnScrimClick: true,
    children: null,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

/** Trigger + modal reais — clicar no botão abre; fechar, clicar no scrim
 * (quando `closeOnScrimClick`) ou pressionar Esc fecham de verdade, como um
 * consumidor real integraria. Foco entra no card ao abrir, fica preso nele
 * (Tab/Shift+Tab não escapam) e volta pro botão de disparo ao fechar. */
export const Playground: Story = {
  render: (args) => {
    const [open, setOpen] = useState(args.open)
    return (
      <div className="modal-story-wrap">
        <Button onClick={() => setOpen(true)}>Cancelar reserva</Button>
        <Modal
          {...args}
          open={open}
          onClose={() => {
            setOpen(false)
            args.onClose?.()
          }}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Confirmar cancelamento
              </Button>
            </>
          }
        >
          <p className="modal-story-body">
            Essa ação não pode ser desfeita. A reserva será cancelada e o horário liberado na
            agenda.
          </p>
        </Modal>
      </div>
    )
  },
}

/** As três larguras de card lado a lado (Small 400 / Medium 560 / Large
 * 720) — um gatilho por tamanho, cada um abrindo seu próprio modal, para
 * comparação direta sem empilhar diálogos. */
export const Sizes: Story = {
  render: (args) => {
    const [openSize, setOpenSize] = useState<'sm' | 'md' | 'lg' | null>(null)
    return (
      <div className="modal-story-sizes-wrap">
        <Button onClick={() => setOpenSize('sm')}>Small (400px)</Button>
        <Button onClick={() => setOpenSize('md')}>Medium (560px)</Button>
        <Button onClick={() => setOpenSize('lg')}>Large (720px)</Button>

        <Modal
          {...args}
          title="Small (400px)"
          size="sm"
          open={openSize === 'sm'}
          onClose={() => setOpenSize(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpenSize(null)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={() => setOpenSize(null)}>
                Confirmar
              </Button>
            </>
          }
        >
          <p className="modal-story-body">Confirmação simples sim/não.</p>
        </Modal>

        <Modal
          {...args}
          title="Medium (560px)"
          size="md"
          open={openSize === 'md'}
          onClose={() => setOpenSize(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpenSize(null)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={() => setOpenSize(null)}>
                Salvar
              </Button>
            </>
          }
        >
          <p className="modal-story-body">Formulário curto de poucos campos.</p>
        </Modal>

        <Modal
          {...args}
          title="Large (720px)"
          size="lg"
          open={openSize === 'lg'}
          onClose={() => setOpenSize(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpenSize(null)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={() => setOpenSize(null)}>
                Concluir
              </Button>
            </>
          }
        >
          <p className="modal-story-body">Conteúdo maior, ex.: tabela ou lista dentro do modal.</p>
        </Modal>
      </div>
    )
  },
}
