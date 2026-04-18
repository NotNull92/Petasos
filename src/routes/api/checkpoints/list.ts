/**
 * Checkpoints List API
 * Lists git commits with optional checkpoint (tag) markers.
 * Query params: ?path=<workspace>&limit=<N>&since=<iso>&author=<name>
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const workspacePath = url.searchParams.get('path') || process.cwd()
          const limit = Math.min(
            Math.max(parseInt(url.searchParams.get('limit') || '10', 10), 1),
            100,
          )
          const since = url.searchParams.get('since') || ''

          // Build git log command — structured output
          const format =
            '%H%n%h%n%an%n%ae%n%aI%n%s%n%b%n---COMMIT_END---'
          let logArgs = [
            'log',
            `--max-count=${limit}`,
            `--format=${format}`,
            '--no-color',
          ]
          if (since) {
            logArgs.push(`--since=${since}`)
          }

          const logRaw = await execGit(logArgs, workspacePath)

          // Parse commits
          const commits = logRaw
            .split('---COMMIT_END---')
            .filter((block) => block.trim())
            .map((block) => {
              const lines = block.trim().split('\n')
              return {
                hash: lines[0] || '',
                shortHash: lines[1] || '',
                author: lines[2] || '',
                authorEmail: lines[3] || '',
                date: lines[4] || '',
                subject: lines[5] || '',
                body: lines.slice(6).join('\n').trim(),
              }
            })
            .filter((c) => c.hash)

          // Get tags (checkpoints)
          const tagRaw = await execGit(
            ['tag', '--list', '--format=%(refname:short) %(objectname)'],
            workspacePath,
          )
          const tagMap = new Map<string, string>()
          tagRaw
            .split('\n')
            .filter(Boolean)
            .forEach((line) => {
              const [tag, commitHash] = line.trim().split(' ')
              if (tag && commitHash) {
                tagMap.set(commitHash, tag)
              }
            })

          // Get diffstat per commit (shortstat only for list view)
          const enriched = await Promise.all(
            commits.map(async (commit) => {
              let diffStat = ''
              try {
                diffStat = await execGit(
                  ['show', '--stat', '--format=', commit.hash],
                  workspacePath,
                )
              } catch {
                // First commit or no parent — diffstat unavailable
              }

              return {
                ...commit,
                checkpoint: tagMap.get(commit.hash) || null,
                diffStat: diffStat.trim(),
              }
            }),
          )

          return json({ ok: true, commits: enriched, total: enriched.length })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err)
          return json(
            { ok: false, error: message, commits: [], total: 0 },
            { status: 500 },
          )
        }
      },
    },
  },
})
