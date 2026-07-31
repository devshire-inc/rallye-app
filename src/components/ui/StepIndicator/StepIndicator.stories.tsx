import type { Meta, StoryObj } from '@storybook/react-vite'
import { StepIndicator } from './StepIndicator'

const meta = {
  title: 'ui/StepIndicator',
  component: StepIndicator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Figma\'s "Label" property is a single value shared across all 5 Total×Current variants (node 320:1319) — editing it in one variant rewrites the rest, so the master value is a generic placeholder, never real text. This component makes `label` a required prop instead, so every usage supplies its own real "Passo X de Y" text.',
      },
    },
  },
  argTypes: {
    total: { control: 'select', options: [2, 3] },
    current: { control: 'number', min: 1, max: 3 },
    label: { control: 'text' },
  },
  args: {
    total: 3,
    current: 1,
    label: 'Passo 1 de 3',
  },
} satisfies Meta<typeof StepIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Total=2 x Current=1|2 — the matrix has no Current=3 for Total=2. */
export const TwoSteps: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: 240 }}>
      <StepIndicator total={2} current={1} label="Passo 1 de 2" />
      <StepIndicator total={2} current={2} label="Passo 2 de 2" />
    </div>
  ),
}

/** Total=3 x Current=1..3 — each instance below has its own `label`, exactly the manual override the Figma doc requires (never derived from total/current). */
export const ThreeSteps: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: 240 }}>
      <StepIndicator total={3} current={1} label="Passo 1 de 3" />
      <StepIndicator total={3} current={2} label="Passo 2 de 3" />
      <StepIndicator total={3} current={3} label="Passo 3 de 3" />
    </div>
  ),
}
