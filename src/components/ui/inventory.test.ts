import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const UI_DIR = 'src/components/ui'

const EXPECTED = [
  'Avatar',
  'Badge',
  'BottomNav',
  'Button',
  'Card',
  'Checkbox',
  'ClassCard',
  'CourtCard',
  'DatePicker',
  'IconButton',
  'Input',
  'ProductCard',
  'Segmented',
  'Select',
  'SlotChip',
  'SportTag',
  'StatCard',
  'Switch',
  'Tabs',
  'TimePicker',
]

// Eager glob so each component's exports can be inspected without per-name dynamic
// import() calls (which Vite/Vitest cannot statically analyze from a runtime string).
const componentModules = import.meta.glob<Record<string, unknown>>(
  ['./*/*.tsx', '!./*/*.test.tsx'],
  {
    eager: true,
  },
)

describe('component inventory', () => {
  it('has exactly 20 component subdirectories matching the catalog', () => {
    const dirs = readdirSync(UI_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(dirs).toEqual([...EXPECTED].sort())
  })

  it.each(EXPECTED)('%s exports its component by name', (name) => {
    const key = `./${name}/${name}.tsx`
    const mod = componentModules[key]
    expect(mod, `expected module at ${key}`).toBeDefined()
    expect(typeof mod![name]).toBe('function')
  })
})
