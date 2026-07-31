import type { Meta, StoryObj } from '@storybook/react-vite'
import { BracketConnector } from './BracketConnector'
import './BracketConnector.stories.css'

const meta = {
  title: 'ui/BracketConnector',
  component: BracketConnector,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'radio', options: ['merge', 'up', 'down', 'bye'] },
  },
  args: {
    type: 'merge',
  },
} satisfies Meta<typeof BracketConnector>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade dos 4 tipos (Figma node 265:1390) — geometria fixa 40x108, sempre
 * aria-hidden (decorativo). Fundo listrado só para tornar o traço visível
 * no Docs, não faz parte do componente. */
export const Types: Story = {
  render: () => (
    <div className="bracket-connector-story-row">
      {(['merge', 'up', 'down', 'bye'] as const).map((type) => (
        <div className="bracket-connector-story-cell" key={type}>
          <BracketConnector type={type} />
          <span className="bracket-connector-story-label">{type}</span>
        </div>
      ))}
    </div>
  ),
}
