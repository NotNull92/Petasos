/**
 * Checkpoints Pin API
 * Creates a git tag (checkpoint) on a specific commit.
 * POST body: { path, hash, label }
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/pin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as {
            path?: string
            hash?: string
            label?: string
          }
          const workspacePath = body.path || process.cwd()
          const hash = body.hash
          const label = body.label

          if (!hash) {
            return json(
              { ok: false, error: 'hash is required' },
              { status: 400 },
            )
          }

          // Validate commit exists
          try {
            await execGit(
              ['rev-parse', '--verify', hash],
              workspacePath,
            )
          } catch {
            return json(
              { ok: false, error: `Commit ${hash} not found` },
              { status: 404 },
            )
          }

          // Generate tag name
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const tagName = label
            ? `checkpoint/${label.replace(/[^a-zA-Z0-9가-힣_-]/g, '-')}`
            : `checkpoint/${timestamp}`

          // Create lightweight tag
          await execGit(['tag', tagName, hash], workspacePath)

          return json({
            ok: true,
            tag: tagName,
            hash,
            message: `Checkpoint "${tagName}" created`,
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
