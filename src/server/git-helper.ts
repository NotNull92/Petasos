/**
 * Git helper for server-side git commands.
 * Centralized error handling and sanitization.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Execute a git command in the given working directory.
 * Returns trimmed stdout. Throws on non-zero exit.
 */
export async function execGit(
  args: string[],
  cwd: string,
  timeout = 15_000,
): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout,
    maxBuffer: 5 * 1024 * 1024, // 5MB for large diffs
    encoding: 'utf-8',
  })
  return stdout.trim()
}

/**
 * Sanitize a path to prevent directory traversal.
 * Only allows absolute paths or relative paths without ..
 */
export function sanitizePath(input: string): string {
  if (!input) return ''
  // Reject traversal attempts
  if (input.includes('..')) return ''
  return input
}
