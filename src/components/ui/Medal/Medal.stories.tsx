import type { Meta, StoryObj } from '@storybook/react-vite'
import { Medal, type MedalSize, type MedalTier } from './Medal'
import './Medal.stories.css'

const TIERS: MedalTier[] = ['bronze', 'prata', 'ouro', 'platina', 'diamante']
const SIZES: MedalSize[] = ['sm', 'md', 'lg']

const meta = {
  title: 'ui/Medal',
  component: Medal,
  tags: ['autodocs'],
  argTypes: {
    tier: { control: 'select', options: TIERS },
    size: { control: 'select', options: SIZES },
  },
  args: {
    tier: 'ouro',
    size: 'md',
  },
} satisfies Meta<typeof Medal>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Tier=bronze..diamante x Size=Small(32)/Medium(48)/Large(64) — espelha o
 * frame "Medal" (node 196:32) do Figma. */
export const AllTiersAndSizes: Story = {
  render: () => (
    <div className="medal-story-grid">
      {TIERS.map((tier) => (
        <div key={tier} className="medal-story-row">
          {SIZES.map((size) => (
            <Medal key={size} tier={tier} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
}
