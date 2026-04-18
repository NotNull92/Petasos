/**
 * Checkpoints Diff API
 * Returns git diff between two commits (or a single commit against its parent).
 * Query params: ?path=<workspace>&from=<hash>&to=<hash>
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/diff')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const workspacePath =
            url.searchParams.get('path') || process.cwd()
          const from = url.searchParams.get('from') || ''
          const to = url.searchParams.get('to') || ''

          if (!from && !to) {
            return json(
              { ok: false, error: 'from or to parameter required' },
              { status: 400 },
            )
          }

          // Single commit diff (commit vs parent)
          if (from && !to) {
            const diff = await execGit(
              ['show', '--format=', '--patch', from],
              workspacePath,
            )
            const stat = await execGit(
              ['show', '--format=', '--stat', from],
              workspacePath,
            )
            return json({
              ok: true,
              diff: diff,
              stat: stat,
              from,
              to: `${from}^`,
            })
          }

          // Diff between two commits
          const diff = await execGit(
            ['diff', `${from}..${to}`],
            workspacePath,
          )
          const stat = await execGit(
            ['diff', '--stat', `${from}..${to}`],
            workspacePath,
          )

          return json({ ok: true, diff, stat, from, to })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err)
          return json(
            { ok: false, error: message, diff: '', stat: '' },
            { status: 500 },
          )
        }
      },
    },
  },
})
