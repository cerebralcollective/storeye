import { render, screen, waitFor } from '@testing-library/react'
import { test, expect } from 'vitest'
import DocView from './DocView'

test('renders sample document when no API configured', async () => {
  render(<DocView />)
  await waitFor(() => expect(screen.getByText(/Document/i)).toBeInTheDocument())
})
