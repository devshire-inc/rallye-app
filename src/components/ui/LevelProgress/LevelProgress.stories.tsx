import type { Meta, StoryObj } from '@storybook/react-vite'
import { LevelProgress } from './LevelProgress'

const meta = {
  title: 'ui/LevelProgress',
  component: LevelProgress,
  tags: ['autodocs'],
  argTypes: {
    criterion: { control: 'text' },
    percent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    currentLevel: { control: 'text' },
    nextLevel: { control: 'text' },
  },
  args: {
    criterion: 'Faltam 3 vitórias para o nível C',
    percent: 68,
    currentLevel: 'D',
    nextLevel: 'C',
  },
} satisfies Meta<typeof LevelProgress>

export default meta
type Story = StoryObj<typeof meta>

/** `percent` é um slider de Controls de verdade — arraste para conferir que
 * o preenchimento e o `%` visível reagem, e que `aria-valuenow` acompanha
 * (ver LevelProgress.test.tsx). Espelha "Progress=Default" (node 196:33). */
export const Playground: Story = {}

export const NearComplete: Story = {
  args: {
    criterion: 'Falta 1 vitória para o nível C',
    percent: 92,
  },
}

export const JustStarted: Story = {
  args: {
    criterion: 'Faltam 9 vitórias para o nível C',
    percent: 8,
  },
}
