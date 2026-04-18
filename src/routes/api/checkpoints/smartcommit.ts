/**
 * Smart Commit API
 * Reads uncommitted changes, generates a detailed commit message, commits, and pushes.
 */
import * as os from 'node:os'
import * as path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { execGit } from '../../../server/git-helper'

/**
 * Categorize file paths into conventional commit prefixes.
 */
function categorizeFile(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.includes('test') || lower.includes('spec') || lower.includes('__test__'))
    return 'test'
  if (lower.includes('fix') || lower.includes('bug') || lower.includes('patch'))
    return 'fix'
  if (lower.includes('feat') || lower.includes('new') || lower.includes('add'))
    return 'feat'
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less') || lower.includes('style'))
    return 'style'
  if (lower.includes('refactor') || lower.includes('rename') || lower.includes('reorg'))
    return 'refactor'
  if (lower.endsWith('.md') || lower.includes('readme') || lower.includes('doc'))
    return 'docs'
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.includes('config'))
    return 'chore'
  if (lower.includes('i18n') || lower.includes('locale') || lower.includes('lang') || lower.includes('translat'))
    return 'i18n'
  return 'update'
}

/**
 * Infer commit type from the dominant category.
 */
function inferType(categories: Record<string, number>): string {
  let max = 0
  let dominant = 'chore'
  for (const [cat, count] of Object.entries(categories)) {
    if (count > max) {
      max = count
      dominant = cat
    }
  }
  return dominant
}

/**
 * Parse git status --porcelain output into structured changes.
 */
function parseStatus(output: string): { file: string; status: string }[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      file: line.slice(3).replace(/^"|"$/g, ''),
    }))
}

/**
 * Summarize a single file's diff into a human-readable line.
 */
function summarizeFileDiff(diffLines: string[], filePath: string): string {
  const added = diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  const deleted = diffLines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length

  const parts: string[] = []
  if (added > 0) parts.push(`+${added}`)
  if (deleted > 0) parts.push(`-${deleted}`)

  return `${filePath} (${parts.join(', ')})`
}

export const Route = createFileRoute('/api/checkpoints/smartcommit')({
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

          // Check for uncommitted changes
          const statusOutput = await execGit(['status', '--porcelain'], resolved)
          if (!statusOutput.trim()) {
            return json({ ok: false, error: '커밋할 변경사항이 없습니다' })
          }

          const changes = parseStatus(statusOutput)
          const categories: Record<string, number> = {}

          // Get diff stat for each file and build detailed message
          const fileSummaries: string[] = []
          for (const change of changes) {
            const cat = categorizeFile(change.file)
            categories[cat] = (categories[cat] ?? 0) + 1

            try {
              const fileDiff = await execGit(
                ['diff', '--unified=0', '--', change.file],
                resolved,
              )
              if (fileDiff) {
                const diffLines = fileDiff.split('\n')
                fileSummaries.push(summarizeFileDiff(diffLines, change.file))
              } else {
                fileSummaries.push(`${change.file} (${change.status})`)
              }
            } catch {
              fileSummaries.push(`${change.file} (${change.status})`)
            }
          }

          // Infer commit type and build message
          const type = inferType(categories)
          const repoName = path.basename(resolved)

          // Build detailed subject
          const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1])
          const scopeParts = catEntries.map(([cat, count]) => `${cat}×${count}`)
          const subject = `${type}: ${repoName} — ${scopeParts.join(', ')} (${changes.length} files)`

          // Build body
          const bodyLines: string[] = ['', 'Changes:']
          for (const summary of fileSummaries) {
            bodyLines.push(`  - ${summary}`)
          }

          // Get overall stat
          try {
            const stat = await execGit(['diff', '--stat'], resolved)
            if (stat) {
              bodyLines.push('')
              bodyLines.push(stat)
            }
          } catch {
            // ignore
          }

          const fullMessage = subject + '\n' + bodyLines.join('\n')

          // Stage all, commit, push
          await execGit(['add', '-A'], resolved)
          await execGit(['commit', '-m', fullMessage], resolved, 30_000)

          // Push (non-blocking — don't fail if no remote)
          let pushOk = true
          try {
            await execGit(['push'], resolved, 30_000)
          } catch (e) {
            pushOk = false
            const msg = e instanceof Error ? e.message : String(e)
            return json({
              ok: true,
              message: fullMessage,
              committed: true,
              pushed: false,
              pushError: msg,
              files: changes.length,
            })
          }

          return json({
            ok: true,
            message: fullMessage,
            committed: true,
            pushed: pushOk,
            files: changes.length,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
