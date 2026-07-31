import type { Meta, StoryObj } from '@storybook/react-vite'
import { SPORTS } from '../../../lib/sports'
import { SportTag } from './SportTag'
import './SportTag.stories.css'

const meta = {
  title: 'ui/SportTag',
  component: SportTag,
  tags: ['autodocs'],
  argTypes: {
    sport: {
      control: 'select',
      options: SPORTS.map((sport) => sport.slug),
    },
    solid: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    sport: 'beach_tennis',
    solid: false,
  },
} satisfies Meta<typeof SportTag>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Grade completa dos 6 esportes × soft (Solid=false)/solid (Solid=true) —
 * espelha o frame "Sport=..., Solid=..." (node 27:45) do Figma. */
export const AllSports: Story = {
  render: () => (
    <div className="sport-tag-story-grid">
      {SPORTS.map((sport) => (
        <SportTag key={`${sport.slug}-soft`} sport={sport.slug} />
      ))}
      {SPORTS.map((sport) => (
        <SportTag key={`${sport.slug}-solid`} sport={sport.slug} solid />
      ))}
    </div>
  ),
}
