/**
 * Checkpoints Repos API
 * Scans a base directory for git repositories.
 * Query params: ?base=<path> (default: ~/Desktop/Cowork)
 */
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

type RepoInfo = {
  name: string
  path: string
  branch: string
  lastCommit: string
  lastCommitDate: string
  lastCommitAuthor: string
  hasChanges: boolean
  commitCount: number
  checkpointCount: number
}

async function scanGitRepos(baseDir: string): Promise<RepoInfo[]> {
  let entries: string[]
  try {
    entries = (await fs.readdir(baseDir)).filter((e) => !e.startsWith('.'))
  } catch {
    return []
  }

  const repos: RepoInfo[] = []

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry)
    const gitDir = path.join(fullPath, '.git')

    try {
      const stat = await fs.stat(gitDir)
      if (!stat.isDirectory() && !stat.isFile()) continue
    } catch {
      continue
    }

    try {
      const branch = await execGit(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        fullPath,
      )
      const lastDate = await execGit(
        ['log', '-1', '--format=%aI', '--no-color'],
        fullPath,
      )
      const lastSubject = await execGit(
        ['log', '-1', '--format=%s', '--no-color'],
        fullPath,
      )
      const lastAuthor = await execGit(
        ['log', '-1', '--format=%an', '--no-color'],
        fullPath,
      )
      const countRaw = await execGit(
        ['rev-list', '--count', 'HEAD'],
        fullPath,
      )
      const checkpointRaw = await execGit(
        ['tag', '--list', 'checkpoint/*'],
        fullPath,
      )
      const checkpointCount = checkpointRaw
        .split('\n')
        .filter(Boolean).length

      // Check for uncommitted changes
      let hasChanges = false
      try {
        const statusOutput = await execGit(
          ['status', '--porcelain'],
          fullPath,
        )
        hasChanges = statusOutput.trim().length > 0
      } catch {
        // ignore status errors
      }

      repos.push({
        name: entry,
        path: fullPath,
        branch: branch || 'unknown',
        lastCommit: lastSubject || '',
        lastCommitDate: lastDate || '',
        lastCommitAuthor: lastAuthor || '',
        hasChanges,
        commitCount: parseInt(countRaw, 10) || 0,
        checkpointCount,
      })
    } catch {
      // git repo but broken — skip
    }
  }

  // Sort by last commit date descending
  repos.sort(
    (a, b) =>
      new Date(b.lastCommitDate).getTime() -
      new Date(a.lastCommitDate).getTime(),
  )

  return repos
}

export const Route = createFileRoute('/api/checkpoints/repos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const baseDir =
            url.searchParams.get('base') ||
            path.join(os.homedir(), 'Desktop', 'Cowork')

          const repos = await scanGitRepos(baseDir)

          return json({ ok: true, repos, base: baseDir })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err)
          return json(
            { ok: false, error: message, repos: [] },
            { status: 500 },
          )
        }
      },

      DELETE: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const body = (await request.json()) as {
            path?: string
            remote?: boolean
          }
          const repoPath = body.path || ''
          const deleteRemote = body.remote === true

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

          // Verify it's actually a git repo
          const gitDir = path.join(resolved, '.git')
          try {
            const stat = await fs.stat(gitDir)
            if (!stat.isDirectory() && !stat.isFile()) {
              throw new Error('not a git repo')
            }
          } catch {
            return json(
              { ok: false, error: '유효한 git 레포지토리가 아닙니다' },
              { status: 400 },
            )
          }

          const repoName = path.basename(resolved)
          const errors: string[] = []

          // Delete remote if requested
          if (deleteRemote) {
            try {
              // Get remote name (usually 'origin')
              const remoteName = await execGit(
                ['remote'],
                resolved,
              )
              const remotes = remoteName.split('\n').filter(Boolean)

              for (const remote of remotes) {
                try {
                  // Get current branch
                  const branch = await execGit(
                    ['rev-parse', '--abbrev-ref', 'HEAD'],
                    resolved,
                  )
                  // Delete remote branch
                  await execGit(
                    ['push', remote, '--delete', branch],
                    resolved,
                    30_000,
                  )
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e)
                  errors.push(`원격 브랜치 삭제 실패 (${remote}): ${msg}`)
                }

                try {
                  // Delete remote itself
                  await execGit(
                    ['remote', 'remove', remote],
                    resolved,
                  )
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e)
                  errors.push(`remote 제거 실패 (${remote}): ${msg}`)
                }
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              errors.push(`원격 삭제 실패: ${msg}`)
            }
          }

          // Delete local directory
          await fs.rm(resolved, { recursive: true, force: true })

          return json({
            ok: true,
            deleted: repoName,
            remoteDeleted: deleteRemote,
            errors: errors.length > 0 ? errors : undefined,
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
