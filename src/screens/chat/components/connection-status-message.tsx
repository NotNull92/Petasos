import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, WifiDisconnected01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type ConnectionStatusMessageProps = {
  state: 'checking' | 'error'
  error?: string | null
  status?: number | null
  onRetry?: () => void
  className?: string
}

function classifyConnectionError(
  error?: string | null,
  status?: number | null,
): {
  title: string
  description: string
  action: string
} {
  const normalizedError = error?.trim()
  const lower = normalizedError?.toLowerCase() ?? ''

  if (!normalizedError && !status) {
    return {
      title: '연결 안 됨',
      description: 'Petasos가 Hermes에 연결할 수 없습니다.',
      action: 'Hermes가 실행 중인지 확인 후 다시 시도하세요.',
    }
  }

  if (
    status === 401 ||
    lower.includes('auth') ||
    lower.includes('token') ||
    lower.includes('unauthorized')
  ) {
    return {
      title: '인증 필요',
      description: 'Hermes가 연결 토큰을 거부했습니다.',
      action: '설정 → 고급 → Hermes에서 토큰을 업데이트하세요.',
    }
  }

  if (
    status === 403 ||
    lower.includes('pair') ||
    lower.includes('not paired')
  ) {
    return {
      title: '페어링 필요',
      description: '이 기기는 아직 Hermes와 연결되지 않았습니다.',
      action: 'Hermes Agent 연결을 확인하세요.',
    }
  }

  if (lower.includes('econnrefused') && lower.includes('8642')) {
    return {
      title: 'Hermes WebAPI 미실행',
      description: 'Hermes WebAPI 서버가 8642 포트에서 실행되고 있지 않습니다.',
      action: 'Run: cd hermes-agent && pip install -e . && hermes-webapi',
    }
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return {
      title: 'Hermes 연결 불가',
      description: '설정된 URL에서 Hermes에 연결할 수 없습니다.',
      action: 'Hermes가 실행 중이고 URL이 올바른지 확인하세요.',
    }
  }

  return {
    title: '연결 오류',
    description: normalizedError || '문제가 발생했습니다.',
    action: '새로고침하거나 설정 → 고급 → Hermes를 확인하세요.',
  }
}

export function ConnectionStatusMessage({
  state,
  error,
  status,
  onRetry,
  className,
}: ConnectionStatusMessageProps) {
  const isChecking = state === 'checking'
  const [visible, setVisible] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)
  const errorInfo = classifyConnectionError(error, status)

  // Auto-dismiss when server comes back
  useEffect(() => {
    function handleRestored() {
      setFadingOut(true)
      setTimeout(() => setVisible(false), 300)
    }
    window.addEventListener('hermes:health-restored', handleRestored)
    return () =>
      window.removeEventListener('hermes:health-restored', handleRestored)
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'mx-auto max-w-lg rounded-lg border px-3 py-2 transition-all duration-300',
        isChecking
          ? 'border-primary-200 bg-primary-50 text-primary-600'
          : 'border-amber-200 bg-amber-50 text-amber-800',
        fadingOut && 'opacity-0 translate-y-[-4px]',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <HugeiconsIcon
          icon={isChecking ? WifiDisconnected01Icon : Alert02Icon}
          size={16}
          strokeWidth={1.5}
          className={cn(
            'mt-0.5 shrink-0',
            isChecking ? 'text-primary-500' : 'text-amber-600',
          )}
        />
        <div className="flex-1 text-xs">
          <p className="font-medium">
            {isChecking ? 'Hermes에 연결 중...' : errorInfo.title}
          </p>
          {!isChecking ? (
            <>
              <p className="mt-0.5 text-amber-700">{errorInfo.description}</p>
              <p className="mt-1 font-medium text-amber-800">
                {errorInfo.action}
              </p>
            </>
          ) : null}
        </div>
        {!isChecking && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:hover:bg-amber-900/30"
          >
            재시도
          </button>
        )}
      </div>
    </div>
  )
}
