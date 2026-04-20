/**
 * Git Pull API
 * Pulls latest changes from remote for a given repo.
 */
import * as os from 'node:os'
import * as path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

export const Route = createFileRoute('/api/checkpoints/pull')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as { path?: string }
          const repoPath = body.path || ''

          if (!repoPath) {
            return json({ ok: false, error: 'path is required' }, { status: 400 })
          }

          // Validate: must be under ~/Desktop/Cowork
          const cowDir = path.join(os.homedir(), 'Desktop', 'Cowork')
          const resolved = path.resolve(repoPath)
          if (!resolved.startsWith(cowDir)) {
            return json(
              { ok: false, error: '경로가 Cowork 폴더 외부입니다' },
              { status: 403 },
            )
          }

          // Get current branch
          const branch = await execGit(['branch', '--show-current'], resolved)

          // Try git pull first; if no tracking info, fallback to pull origin <branch>
          let output: string
          try {
            output = await execGit(['pull'], resolved, 60_000)
          } catch {
            // Fallback: pull from origin/<branch>
            output = await execGit(['pull', 'origin', branch], resolved, 60_000)
          }

          // Check if there were actual updates
          const alreadyUpToDate = output.includes('Already up to date') || output.includes('이미 최신 상태입니다')

          return json({
            ok: true,
            message: output,
            updated: !alreadyUpToDate,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
