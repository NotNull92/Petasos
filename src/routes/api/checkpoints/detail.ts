/**
 * Checkpoints Detail API
 * Returns detailed info for a single commit.
 * Query params: ?path=<workspace>&hash=<hash>
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/detail')({
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
          const hash = url.searchParams.get('hash')

          if (!hash) {
            return json(
              { ok: false, error: 'hash parameter required' },
              { status: 400 },
            )
          }

          // Commit metadata
          const format =
            '%H%n%h%n%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%s%n%b'
          const metaRaw = await execGit(
            ['show', '--no-patch', `--format=${format}`, hash],
            workspacePath,
          )
          const lines = metaRaw.split('\n')

          // Changed files (name-status)
          const filesRaw = await execGit(
            ['diff-tree', '--no-commit-id', '--name-status', '-r', hash],
            workspacePath,
          )
          const files = filesRaw
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [status, ...pathParts] = line.split('\t')
              return {
                status: status?.charAt(0) || '?',
                path: pathParts.join('\t'),
              }
            })

          // Shortstat (total additions/deletions)
          const shortstat = await execGit(
            ['show', '--no-patch', '--shortstat', hash],
            workspacePath,
          )

          // Check for checkpoint tag
          const tagsRaw = await execGit(
            ['tag', '--list', '--points-at', hash],
            workspacePath,
          )
          const tags = tagsRaw.split('\n').filter(Boolean)
          const checkpointTag =
            tags.find((t) => t.startsWith('checkpoint/')) || null

          return json({
            ok: true,
            commit: {
              hash: lines[0] || hash,
              shortHash: lines[1] || '',
              author: lines[2] || '',
              authorEmail: lines[3] || '',
              authorDate: lines[4] || '',
              committer: lines[5] || '',
              committerEmail: lines[6] || '',
              committerDate: lines[7] || '',
              subject: lines[8] || '',
              body: lines.slice(9).join('\n').trim(),
            },
            files,
            shortstat: shortstat.trim(),
            checkpoint: checkpointTag,
            tags,
          })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err)
          return json(
            { ok: false, error: message },
            { status: 500 },
          )
        }
      },
    },
  },
})
