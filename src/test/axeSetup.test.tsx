import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import LogoutButton from '../components/LogoutButton'

describe('jest-axe setup', () => {
  it('finds no accessibility violations in LogoutButton', async () => {
    const { container } = render(
      <MemoryRouter>
        <LogoutButton />
      </MemoryRouter>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
