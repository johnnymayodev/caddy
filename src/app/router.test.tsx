import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function render(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return renderToString(<RouterProvider router={router} />)
}

async function renderInitialized(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  router.initialize()
  // Let the redirect navigation complete before rendering.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return renderToString(<RouterProvider router={router} />)
}

describe('router', () => {
  it('renders each screen inside the shell', () => {
    const cases: Array<[path: string, expected: string]> = [
      ['/', 'No round in progress'],
      ['/history', 'Finished rounds will be listed here.'],
      ['/courses', 'Add a course'],
      ['/courses/new', 'Name the course'],
      ['/courses/abc', 'course abc'],
      ['/players', 'Players you add'],
      ['/rounds/new', 'Pick a course and players'],
      ['/rounds/abc', 'Round abc'],
    ]

    for (const [path, expected] of cases) {
      const html = render(path)
      expect(html, `expected ${path} to render "${expected}"`).toContain(
        expected,
      )
      expect(html, `expected the shell tab bar on ${path}`).toContain(
        'History',
      )
    }
  })

  it('sends unknown paths back to play', async () => {
    expect(await renderInitialized('/nope')).toContain('No round in progress')
  })
})
