import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttendanceGroup, AttendanceToggle, type AttendanceKind } from './AttendanceToggle'
import './AttendanceToggle.stories.css'

const meta = {
  title: 'ui/AttendanceToggle',
  component: AttendanceToggle,
  tags: ['autodocs'],
  argTypes: {
    kind: {
      control: 'select',
      options: ['present', 'absent', 'justified'],
    },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    kind: 'present',
    selected: false,
    disabled: false,
    onClick: () => {},
  },
} satisfies Meta<typeof AttendanceToggle>

export default meta
type Story = StoryObj<typeof meta>

/** Real per-student check-in row: 3 mutually exclusive toggles (Present /
 * Absent / Justified) via `AttendanceGroup` — clicking one in the Storybook
 * canvas actually deselects the others, it isn't a static snapshot. */
export const Playground: Story = {
  render: () => {
    const [value, setValue] = useState<AttendanceKind | null>('present')
    return <AttendanceGroup ariaLabel="Presença de João" value={value} onChange={setValue} />
  },
}

/** Kind x Selected grid — espelha o frame de variantes (node 99:26) do Figma. */
export const States: Story = {
  render: () => {
    const kinds: AttendanceKind[] = ['present', 'absent', 'justified']
    return (
      <div className="attendance-toggle-story-rows">
        {kinds.map((kind) => (
          <div key={kind} className="attendance-toggle-story-row">
            <span className="attendance-toggle-story-row__label">{kind}</span>
            <AttendanceToggle kind={kind} selected={false} />
            <AttendanceToggle kind={kind} selected />
          </div>
        ))}
      </div>
    )
  },
}
