import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { OtpInput, type OtpInputProps } from './OtpInput'
import './OtpInput.stories.css'

/** No-op tipado: só preenche o arg obrigatório do meta — as stories
 * assumem o controle do handler. */
const noop: OtpInputProps['onChange'] = () => {}

const meta = {
  title: 'ui/OtpInput (Code Input)',
  component: OtpInput,
  tags: ['autodocs'],
  argTypes: {
    length: { control: 'radio', options: [4, 6] },
    mode: { control: 'radio', options: ['numeric', 'alphanumeric'] },
    error: { control: 'boolean' },
    disabled: { control: 'boolean' },
    autoFocus: { control: 'boolean' },
  },
  args: {
    // `value`/`onChange` são obrigatórios no componente (controlado); todas as
    // stories abaixo assumem o controle via `useState`, então aqui servem só
    // para satisfazer os args obrigatórios do meta.
    value: '',
    onChange: noop,
    length: 6,
    mode: 'numeric',
    error: false,
    disabled: false,
    autoFocus: false,
  },
} satisfies Meta<typeof OtpInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Real controlled state — typing/pasting a code, and the `error`/`length`
 * Controls, all actually re-render the boxes (not a static args snapshot).
 */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState('')
    return (
      <OtpInput
        {...args}
        value={value}
        onChange={setValue}
        onComplete={(code) => console.log('Código completo:', code)}
      />
    )
  },
}

/** Grade Length × State (node 277:1574) — Focus é simulado via classe
 * story-only, já que `:focus-visible` real não pode ser mantido em
 * múltiplas caixas ao mesmo tempo (mesmo caveat de Checkbox/Segmented). */
export const States: Story = {
  render: () => (
    <div className="otp-input-story-grid">
      <div>
        <p className="otp-input-story-label">Length=6, Empty</p>
        <OtpInput length={6} value="" onChange={() => {}} />
      </div>
      <div>
        <p className="otp-input-story-label">Length=6, Filled</p>
        <OtpInput length={6} value="123456" onChange={() => {}} />
      </div>
      <div className="otp-input-story--focus">
        <p className="otp-input-story-label">Length=6, Focus</p>
        <OtpInput length={6} value="12" onChange={() => {}} />
      </div>
      <div>
        <p className="otp-input-story-label">Length=6, Error</p>
        <OtpInput length={6} value="123456" error onChange={() => {}} />
      </div>
      <div>
        <p className="otp-input-story-label">Length=4, Empty</p>
        <OtpInput length={4} value="" onChange={() => {}} />
      </div>
      <div>
        <p className="otp-input-story-label">Length=4, Filled</p>
        <OtpInput length={4} value="1234" onChange={() => {}} />
      </div>
    </div>
  ),
}

/** `mode="alphanumeric"` — aceita letras e números (uppercased), pra códigos
 * de backup/suporte que misturam os dois. Padrão continua `numeric`. */
export const Alphanumeric: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return <OtpInput length={6} mode="alphanumeric" value={value} onChange={setValue} />
  },
}

export const Disabled: Story = {
  render: (args) => <OtpInput {...args} value="123" onChange={() => {}} disabled />,
}
