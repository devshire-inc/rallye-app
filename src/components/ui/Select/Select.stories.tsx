import type { Meta, StoryObj } from '@storybook/react-vite'
import { Select } from './Select'
import './Select.stories.css'

const SPORT_OPTIONS = ['Beach Tennis', 'Padel', 'Futevôlei', 'Vôlei de praia', 'Tênis']

const meta = {
  title: 'ui/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    label: 'Esporte',
    placeholder: 'Selecione',
    options: SPORT_OPTIONS,
    error: '',
    disabled: false,
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade Default/Focus/Error/Disabled — espelha o frame "Select" (node 76:27) do
 * Figma. O estado Open é o menu nativo do navegador (renderizado pelo SO/browser
 * ao clicar no controle) e não pode ser demonstrado de forma estática aqui —
 * apenas o visual do controle fechado é fixável via CSS. */
export const States: Story = {
  render: (args) => (
    <div className="select-story-rows">
      <div className="select-story-row">
        <span className="select-story-row__label">Default</span>
        <Select {...args} />
      </div>
      <div className="select-story-row select-story--focus">
        <span className="select-story-row__label">Focus</span>
        <Select {...args} />
      </div>
      <div className="select-story-row">
        <span className="select-story-row__label">Error</span>
        <Select {...args} error="Selecione um esporte" />
      </div>
      <div className="select-story-row">
        <span className="select-story-row__label">Disabled</span>
        <Select {...args} disabled />
      </div>
    </div>
  ),
}
