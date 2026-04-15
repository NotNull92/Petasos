'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = 8_000

type ErrorEntry = {
  id: string
  message: string
  raw?: string
}

function classifyError(raw: string): string {
  const lower = raw.toLowerCase()
  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many')
  ) {
    return '요청 제한 — 잠시 후 다시 시도하세요'
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('api key')
  ) {
    return '인증 오류 — 설정에서 API 키를 확인하세요'
  }
  if (
    lower.includes('500') ||
    lower.includes('server error') ||
    lower.includes('model error')
  ) {
    return '모델 오류 — 제공자에 문제가 있습니다'
  }
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection')
  ) {
    return '연결 끊김 — 재시도 중…'
  }
  // Return original message if no pattern matched
  return raw
}

let externalPush: ((msg: string) => void) | null = null

/** Call this from anywhere to show an error toast */
export function showErrorToast(message: string): void {
  externalPush?.(classifyError(message))
}

type ToastItemProps = {
  entry: ErrorEntry
  onDismiss: (id: string) => void
}

function ToastItem({ entry, onDismiss }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(entry.id), AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [entry.id, onDismiss])

  return (
    <div
      className={cn(
        'flex items-start gap-3 max-w-sm w-full',
        'rounded-xl border border-red-200',
        'shadow-lg px-4 py-3 bg-surface',
        'animate-in slide-in-from-top-2 fade-in duration-200',
      )}
      role="alert"
    >
      <span className="text-red-500 text-base shrink-0 mt-0.5">⚠</span>
      <span className="flex-1 text-[13px] text-ink leading-snug">
        {entry.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        className="shrink-0 text-primary-400 hover:text-primary-600 transition-colors text-lg leading-none"
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  )
}

export function ErrorToastContainer() {
  const [toasts, setToasts] = useState<Array<ErrorEntry>>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev.slice(-4), { id, message }])
  }, [])

  useEffect(() => {
    externalPush = push
    return () => {
      externalPush = null
    }
  }, [push])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-safe-or-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
      aria-live="assertive"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem entry={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
