/**
 * Checkpoints Unpin API
 * Removes a checkpoint tag from a commit.
 * POST body: { path, tag }
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/unpin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as {
            path?: string
            tag?: string
          }
          const workspacePath = body.path || process.cwd()
          const tag = body.tag

          if (!tag) {
            return json(
              { ok: false, error: 'tag is required' },
              { status: 400 },
            )
          }

          // Verify tag exists and is a checkpoint
          if (!tag.startsWith('checkpoint/')) {
            return json(
              {
                ok: false,
                error: 'Only checkpoint/* tags can be removed',
              },
              { status: 400 },
            )
          }

          await execGit(['tag', '-d', tag], workspacePath)

          return json({
            ok: true,
            tag,
            message: `Checkpoint "${tag}" removed`,
          })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err)
          return json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
