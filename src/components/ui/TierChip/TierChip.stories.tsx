import type { Meta, StoryObj } from '@storybook/react-vite'
import { SPORTS } from '../../../lib/sports'
import { TierChip, type TierChipTier } from './TierChip'
import './TierChip.stories.css'

const TIERS: TierChipTier[] = ['pe-na-areia', 'D', 'C', 'B', 'A', 'pro-open']

const meta = {
  title: 'ui/TierChip',
  component: TierChip,
  tags: ['autodocs'],
  argTypes: {
    tier: { control: 'select', options: TIERS },
    sportCssVar: { control: 'select', options: [undefined, ...SPORTS.map((sport) => sport.cssVar)] },
  },
  args: {
    tier: 'B',
  },
} satisfies Meta<typeof TierChip>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Os 6 símbolos do frame "TierChip" (node 195:30), do nível inicial ao Pro/Open. */
export const AllTiers: Story = {
  render: () => (
    <div className="tier-chip-story-row">
      {TIERS.map((tier) => (
        <TierChip key={tier} tier={tier} />
      ))}
    </div>
  ),
}

/** O dot é feito para ser sobrescrito por instância com um token `--sport-*`
 * quando o contexto tem esporte definido — sem isso, cai no padrão
 * `--interactive-primary` (visto acima em Playground/AllTiers). */
export const WithSportOverride: Story = {
  render: () => (
    <div className="tier-chip-story-row">
      {SPORTS.map((sport) => (
        <TierChip key={sport.slug} tier="B" sportCssVar={sport.cssVar} />
      ))}
    </div>
  ),
}
