'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Bookmark01Icon,
  RefreshIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  GitCommitIcon,
  GitCompareIcon,
  PinIcon,
  FolderIcon,
  Delete02Icon,
  Upload03Icon,
} from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

// ── Types ─────────────────────────────────────────────────────────

type GitCommit = {
  hash: string
  shortHash: string
  author: string
  authorEmail: string
  date: string
  subject: string
  body: string
  checkpoint: string | null
  diffStat: string
}

type DiffResponse = {
  ok: boolean
  diff: string
  stat: string
  from: string
  to: string
}

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

// ── API helpers ────────────────────────────────────────────────────

async function fetchCommits(
  workspacePath?: string,
  limit = 10,
): Promise<GitCommit[]> {
  const params = new URLSearchParams()
  if (workspacePath) params.set('path', workspacePath)
  params.set('limit', String(limit))
  const res = await fetch(`/api/checkpoints/list?${params}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load commits')
  return data.commits as GitCommit[]
}

async function fetchDiff(
  from: string,
  to?: string,
  workspacePath?: string,
): Promise<DiffResponse> {
  const params = new URLSearchParams()
  params.set('from', from)
  if (to) params.set('to', to)
  if (workspacePath) params.set('path', workspacePath)
  const res = await fetch(`/api/checkpoints/diff?${params}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load diff')
  return data as DiffResponse
}

async function pinCommit(
  hash: string,
  label: string,
  workspacePath?: string,
) {
  const res = await fetch('/api/checkpoints/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, label, path: workspacePath }),
  })
  return res.json()
}

async function unpinCommit(tag: string, workspacePath?: string) {
  const res = await fetch('/api/checkpoints/unpin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, path: workspacePath }),
  })
  return res.json()
}

async function fetchRepos(): Promise<RepoInfo[]> {
  const res = await fetch('/api/checkpoints/repos')
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to scan repos')
  return data.repos as RepoInfo[]
}

async function deleteRepo(
  repoPath: string,
  remote: boolean,
): Promise<{ ok: boolean; deleted?: string; error?: string; errors?: string[] }> {
  const res = await fetch('/api/checkpoints/repos', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: repoPath, remote }),
  })
  return res.json()
}

async function smartCommit(repoPath: string) {
  const res = await fetch('/api/checkpoints/smartcommit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: repoPath }),
  })
  return res.json() as Promise<{
    ok: boolean
    message?: string
    committed?: boolean
    pushed?: boolean
    pushError?: string
    files?: number
    error?: string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}시간 전`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}일 전`
    return d.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDiffStat(stat: string): {
  additions: number
  deletions: number
  files: number
} {
  const fileMatch = stat.match(/(\d+) files? changed/)
  const addMatch = stat.match(/(\d+) insertion/)
  const delMatch = stat.match(/(\d+) deletion/)
  return {
    files: fileMatch ? parseInt(fileMatch[1], 10) : 0,
    additions: addMatch ? parseInt(addMatch[1], 10) : 0,
    deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
  }
}

// ── Diff Viewer ────────────────────────────────────────────────────

function DiffViewer({ diff }: { diff: string }) {
  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-primary-500 text-sm">
        변경사항 없음
      </div>
    )
  }

  const lines = diff.split('\n')

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++')
        const isDel = line.startsWith('-') && !line.startsWith('---')
        const isHunk = line.startsWith('@@')
        const isHeader =
          line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')

        return (
          <div
            key={i}
            className={cn(
              'px-2 py-0 leading-5 whitespace-pre',
              isAdd && 'bg-emerald-500/10 text-emerald-400',
              isDel && 'bg-red-500/10 text-red-400',
              isHunk && 'bg-blue-500/10 text-blue-400 font-semibold',
              isHeader && 'bg-primary-800/30 text-primary-400 font-semibold',
              !isAdd && !isDel && !isHunk && !isHeader && 'text-primary-300',
            )}
          >
            {line}
          </div>
        )
      })}
    </div>
  )
}

// ── Commit Card ────────────────────────────────────────────────────

function CommitCard({
  commit,
  isSelected,
  isCompareSelected,
  onSelect,
  onCompareSelect,
  onPin,
  onUnpin,
}: {
  commit: GitCommit
  isSelected: boolean
  isCompareSelected: boolean
  onSelect: () => void
  onCompareSelect: () => void
  onPin: (hash: string) => void
  onUnpin: (tag: string) => void
}) {
  const stat = formatDiffStat(commit.diffStat)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-colors',
        isSelected
          ? 'border-accent-500/50 bg-accent-500/5'
          : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:bg-[var(--theme-hover)]',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Timeline dot */}
        <div className="flex flex-col items-center mt-1 shrink-0">
          <div
            className={cn(
              'w-3 h-3 rounded-full border-2',
              commit.checkpoint
                ? 'bg-amber-400 border-amber-400'
                : 'bg-transparent border-primary-500',
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Subject line */}
          <div className="flex items-center gap-2">
            {commit.checkpoint && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <HugeiconsIcon icon={Bookmark01Icon} size={10} />
                {commit.checkpoint.replace('checkpoint/', '')}
              </span>
            )}
            <span className="text-sm font-medium text-primary-100 truncate">
              {commit.subject}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs text-primary-500">
            <span className="font-mono text-primary-400">
              {commit.shortHash}
            </span>
            <span>{commit.author}</span>
            <span>{formatDate(commit.date)}</span>
          </div>

          {/* Diff stat */}
          {stat.files > 0 && (
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="text-primary-500">
                {stat.files}개 파일
              </span>
              {stat.additions > 0 && (
                <span className="text-emerald-400">+{stat.additions}</span>
              )}
              {stat.deletions > 0 && (
                <span className="text-red-400">-{stat.deletions}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2">
            {commit.checkpoint ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnpin(commit.checkpoint!)
                }}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
<HugeiconsIcon icon={PinIcon} size={11} />
                레포 관리 해제
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPin(commit.hash)
                }}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <HugeiconsIcon icon={PinIcon} size={11} />
                레포 관리 지정
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCompareSelect()
              }}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[11px] rounded transition-colors',
                isCompareSelected
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-primary-800/30 text-primary-400 hover:bg-blue-500/10 hover:text-blue-400',
              )}
            >
              <HugeiconsIcon icon={GitCompareIcon} size={11} />
              비교 {isCompareSelected ? '✓' : ''}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Screen ────────────────────────────────────────────────────

const QUERY_KEY = ['checkpoints', 'commits'] as const

export function CheckpointsScreen() {
  const queryClient = useQueryClient()
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [compareHash, setCompareHash] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState<string | null>(null)
  const [workspacePath, setWorkspacePath] = useState<string | undefined>(undefined)

  // Fetch repos
  const reposQuery = useQuery({
    queryKey: ['checkpoints', 'repos'],
    queryFn: fetchRepos,
    staleTime: 60_000,
  })

  // Auto-select first repo on load
  const repos = reposQuery.data ?? []
  const activeRepo = repos.find((r) => r.path === workspacePath)

  // Auto-select first repo when repos load
  if (!workspacePath && repos.length > 0) {
    setWorkspacePath(repos[0].path)
  }

  // Fetch commits for selected repo
  const commitsQuery = useQuery({
    queryKey: [...QUERY_KEY, workspacePath],
    queryFn: () => fetchCommits(workspacePath, 10),
    enabled: !!workspacePath,
    staleTime: 30_000,
  })

  // Fetch diff for selected commit
  const diffQuery = useQuery({
    queryKey: ['checkpoints', 'diff', selectedHash, compareHash],
    queryFn: () =>
      fetchDiff(selectedHash!, compareHash ?? undefined, workspacePath),
    enabled: !!selectedHash,
  })

  const commitsQueryKey = [...QUERY_KEY, workspacePath] as const

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: ({ hash, label }: { hash: string; label: string }) =>
      pinCommit(hash, label, workspacePath),
    onSuccess: (data) => {
      if (data.ok) {
        toast(`레포 관리 "${data.tag}" 생성됨`, { type: 'success' })
        void queryClient.invalidateQueries({ queryKey: commitsQueryKey })
      } else {
        toast(data.error || '레포 관리 생성 실패', { type: 'error' })
      }
    },
    onError: (err) => {
      toast(`오류: ${err.message}`, { type: 'error' })
    },
  })

  // Unpin mutation
  const unpinMutation = useMutation({
    mutationFn: ({ tag }: { tag: string }) =>
      unpinCommit(tag, workspacePath),
    onSuccess: (data) => {
      if (data.ok) {
        toast(`레포 관리 "${data.tag}" 해제됨`, { type: 'success' })
        void queryClient.invalidateQueries({ queryKey: commitsQueryKey })
      } else {
        toast(data.error || '레포 관리 해제 실패', { type: 'error' })
      }
    },
    onError: (err) => {
      toast(`오류: ${err.message}`, { type: 'error' })
    },
  })

  const handlePin = useCallback(
    (hash: string) => {
      setPinInput(hash)
    },
    [],
  )

  const handlePinSubmit = useCallback(() => {
    if (!pinInput) return
    const label = prompt('레포 관리 이름을 입력하세요 (생략 시 자동 생성):')
    pinMutation.mutate({
      hash: pinInput,
      label: label || '',
    })
    setPinInput(null)
  }, [pinInput, pinMutation])

  const handleUnpin = useCallback(
    (tag: string) => {
      unpinMutation.mutate({ tag })
    },
    [unpinMutation],
  )

  // ── Smart commit ──
  const smartCommitMutation = useMutation({
    mutationFn: (repoPath: string) => smartCommit(repoPath),
    onSuccess: (data) => {
      if (data.ok) {
        const pushNote = !data.pushed
          ? ' (푸시 실패: 푸시 안 됨)'
          : ''
        toast(`${data.files}개 파일 커밋+푸시 완료${pushNote}`, { type: 'success' })
        void queryClient.invalidateQueries({ queryKey: commitsQueryKey })
        void queryClient.invalidateQueries({ queryKey: ['checkpoints', 'repos'] })
      } else {
        if (data.error?.includes('없습니다')) {
          toast('커밋할 내역이 없습니다 보스😘', { type: 'info' })
        } else {
          toast(data.error || '빠른 커밋 실패', { type: 'error' })
        }
      }
    },
    onError: (err) => {
      toast(`오류: ${err.message}`, { type: 'error' })
    },
  })

  // ── Delete repo ──
  const [deleteTarget, setDeleteTarget] = useState<RepoInfo | null>(null)

  const deleteLocalMutation = useMutation({
    mutationFn: (repo: RepoInfo) => deleteRepo(repo.path, false),
    onSuccess: (data) => {
      if (data.ok) {
        toast(`"${data.deleted}" 로컬 삭제 완료`, { type: 'success' })
        if (workspacePath === deleteTarget?.path) {
          setWorkspacePath(undefined)
          setSelectedHash(null)
          setCompareHash(null)
        }
        setDeleteTarget(null)
        void queryClient.invalidateQueries({ queryKey: ['checkpoints', 'repos'] })
      } else {
        toast(data.error || '삭제 실패', { type: 'error' })
      }
    },
    onError: (err) => {
      toast(`삭제 오류: ${err.message}`, { type: 'error' })
    },
  })

  const deleteRemoteMutation = useMutation({
    mutationFn: (repo: RepoInfo) => deleteRepo(repo.path, true),
    onSuccess: (data) => {
      if (data.ok) {
        const warn = data.errors?.length
          ? ` (경고: ${data.errors.join(', ')})`
          : ''
        toast(`"${data.deleted}" 로컬+리모트 완전삭제 완료${warn}`, { type: 'success' })
        if (workspacePath === deleteTarget?.path) {
          setWorkspacePath(undefined)
          setSelectedHash(null)
          setCompareHash(null)
        }
        setDeleteTarget(null)
        void queryClient.invalidateQueries({ queryKey: ['checkpoints', 'repos'] })
      } else {
        toast(data.error || '삭제 실패', { type: 'error' })
      }
    },
    onError: (err) => {
      toast(`삭제 오류: ${err.message}`, { type: 'error' })
    },
  })

  const commits = commitsQuery.data ?? []
  const selectedCommit = useMemo(
    () => commits.find((c) => c.hash === selectedHash),
    [commits, selectedHash],
  )

  const compareCommit = useMemo(
    () => commits.find((c) => c.hash === compareHash),
    [commits, compareHash],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={GitCommitIcon}
            size={20}
            className="text-accent-500"
          />
          <h1 className="text-lg font-bold text-primary-100">레포 관리</h1>
          {activeRepo && (
            <span className="text-xs text-primary-500">
              {activeRepo.name} · {activeRepo.branch}
            </span>
          )}
          {commits.length > 0 && (
            <span className="text-xs text-primary-500">
              {commits.length}개 커밋
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: commitsQueryKey })
            void queryClient.invalidateQueries({ queryKey: ['checkpoints', 'repos'] })
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--theme-card)] border border-[var(--theme-border)] text-primary-400 hover:text-primary-200 transition-colors"
        >
          <HugeiconsIcon icon={RefreshIcon} size={14} />
          새로고침
        </button>
      </div>

      {/* Repo tabs */}
      <div className="border-b border-[var(--theme-border)]">
        {reposQuery.isLoading && (
          <div className="flex gap-1 px-3 py-2 overflow-x-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-7 w-24 rounded bg-[var(--theme-hover)] animate-pulse shrink-0"
              />
            ))}
          </div>
        )}
        {repos.length > 0 && (
          <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-thin">
            {repos.map((repo) => (
              <button
                key={repo.path}
                type="button"
                onClick={() => {
                  if (workspacePath !== repo.path) {
                    setWorkspacePath(repo.path)
                    setSelectedHash(null)
                    setCompareHash(null)
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-all shrink-0',
                  workspacePath === repo.path
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30 font-medium'
                    : 'bg-[var(--theme-card)] text-primary-400 border border-[var(--theme-border)] hover:bg-[var(--theme-hover)] hover:text-primary-200',
                )}
              >
                <HugeiconsIcon icon={FolderIcon} size={12} />
                <span>{repo.name}</span>
                {repo.hasChanges && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                )}
                <span className="text-[10px] text-primary-600">
                  {repo.branch}
                </span>
                {repo.checkpointCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0 text-[9px] rounded bg-amber-500/15 text-amber-400 shrink-0">
                    <HugeiconsIcon icon={Bookmark01Icon} size={8} />
                    {repo.checkpointCount}
                  </span>
                )}
                {repo.hasChanges && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      smartCommitMutation.mutate(repo.path)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        smartCommitMutation.mutate(repo.path)
                      }
                    }}
                    className="p-0.5 rounded hover:bg-emerald-500/20 text-primary-600 hover:text-emerald-400 transition-colors"
                    title="빠른 커밋"
                  >
                    <HugeiconsIcon icon={Upload03Icon} size={10} />
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(repo)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      setDeleteTarget(repo)
                    }
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-red-500/20 text-primary-600 hover:text-red-400 transition-colors"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={10} />
                </span>
              </button>
            ))}
          </div>
        )}
        {repos.length === 0 && !reposQuery.isLoading && !reposQuery.error && workspacePath === undefined && (
          <div className="flex items-center justify-center py-4 text-xs text-primary-500">
            <HugeiconsIcon icon={FolderIcon} size={14} className="mr-1.5" />
            Cowork 폴더에 git 레포가 없습니다
          </div>
        )}
      </div>

      {/* Compare bar */}
      {compareHash && selectedHash && compareHash !== selectedHash && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs">
          <HugeiconsIcon icon={GitCompareIcon} size={14} className="text-blue-400" />
          <span className="text-blue-300">
            비교: {compareCommit?.shortHash} → {selectedCommit?.shortHash}
          </span>
          <button
            type="button"
            onClick={() => setCompareHash(null)}
            className="ml-auto text-blue-400 hover:text-blue-300"
          >
            비교 해제
          </button>
        </div>
      )}

      {/* Content: list + diff panel */}
      <div className="flex-1 flex min-h-0">
        {/* Left: commit list */}
        <div className="w-full md:w-1/2 border-r border-[var(--theme-border)] overflow-y-auto">
          {commitsQuery.isLoading && (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 animate-pulse"
                >
                  <div className="h-3.5 bg-[var(--theme-hover)] rounded w-3/4 mb-2" />
                  <div className="h-2.5 bg-[var(--theme-hover)] rounded w-full mb-1" />
                  <div className="h-2.5 bg-[var(--theme-hover)] rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {commitsQuery.error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-primary-500">
              <p>커밋을 불러올 수 없습니다</p>
              <p className="text-xs text-red-400">
                {commitsQuery.error.message}
              </p>
              <button
                type="button"
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: commitsQueryKey })
                }
                className="text-xs text-accent-400 hover:text-accent-300"
              >
                다시 시도
              </button>
            </div>
          )}

          {!workspacePath && !commitsQuery.isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-primary-500 text-sm">
              <HugeiconsIcon icon={FolderIcon} size={32} />
              <p>레포지토리를 선택하세요</p>
              <p className="text-xs">상단 탭에서 프로젝트를 선택하면 커밋 히스토리가 표시됩니다</p>
            </div>
          )}

          {commits.length === 0 && !commitsQuery.isLoading && workspacePath && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-primary-500 text-sm">
              <HugeiconsIcon icon={GitCommitIcon} size={32} />
              <p>커밋이 없습니다</p>
              <p className="text-xs">워크스페이스 경로를 확인하세요</p>
            </div>
          )}

          <AnimatePresence>
            <div className="flex flex-col gap-2 p-3">
              {commits.map((commit) => (
                <CommitCard
                  key={commit.hash}
                  commit={commit}
                  isSelected={selectedHash === commit.hash}
                  isCompareSelected={compareHash === commit.hash}
                  onSelect={() =>
                    setSelectedHash(
                      selectedHash === commit.hash ? null : commit.hash,
                    )
                  }
                  onCompareSelect={() =>
                    setCompareHash(
                      compareHash === commit.hash ? null : commit.hash,
                    )
                  }
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              ))}
            </div>
          </AnimatePresence>
        </div>

        {/* Right: diff panel (desktop only) */}
        {selectedHash && (
          <div className="hidden md:flex flex-col w-1/2 min-h-0">
            {/* Diff header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-primary-400">
                  {compareHash && compareHash !== selectedHash
                    ? `${compareCommit?.shortHash}..${selectedCommit?.shortHash}`
                    : selectedCommit?.shortHash}
                </span>
                <span className="text-primary-500 truncate max-w-[200px]">
                  {selectedCommit?.subject}
                </span>
              </div>
              {diffQuery.data?.stat && (
                <span className="text-[11px] text-primary-500">
                  {diffQuery.data.stat.split('\n').pop()}
                </span>
              )}
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-auto bg-[var(--theme-bg)]">
              {diffQuery.isLoading && (
                <div className="flex items-center justify-center h-full text-primary-500 text-sm">
                  diff 로드 중…
                </div>
              )}
              {diffQuery.error && (
                <div className="flex items-center justify-center h-full text-red-400 text-sm">
                  {diffQuery.error.message}
                </div>
              )}
              {diffQuery.data && <DiffViewer diff={diffQuery.data.diff} />}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <HugeiconsIcon icon={Delete02Icon} size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary-100">
                    레포지토리 삭제
                  </h3>
                  <p className="text-xs text-primary-400 mt-0.5">
                    {deleteTarget.name} · {deleteTarget.branch} · {deleteTarget.commitCount} commits
                  </p>
                </div>
              </div>

              <p className="text-xs text-primary-400 mb-5 leading-relaxed">
                이 작업은 되돌릴 수 없습니다. 삭제 방식을 선택하세요.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={deleteLocalMutation.isPending || deleteRemoteMutation.isPending}
                  onClick={() => deleteLocalMutation.mutate(deleteTarget)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <HugeiconsIcon icon={FolderIcon} size={14} />
                  로컬만 삭제
                  {deleteLocalMutation.isPending && (
                    <span className="ml-1 animate-pulse">...</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={deleteLocalMutation.isPending || deleteRemoteMutation.isPending}
                  onClick={() => deleteRemoteMutation.mutate(deleteTarget)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-600/20 border border-red-600/30 text-red-300 text-sm font-medium hover:bg-red-600/30 transition-colors disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} />
                  로컬 + 리모트 완전삭제
                  {deleteRemoteMutation.isPending && (
                    <span className="ml-1 animate-pulse">...</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="w-full px-4 py-2 rounded-lg text-xs text-primary-500 hover:text-primary-300 transition-colors mt-1"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
