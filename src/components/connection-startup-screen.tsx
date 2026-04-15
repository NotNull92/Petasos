import { useEffect, useRef, useState } from 'react'
import type { AuthStatus } from '@/lib/hermes-auth'
import { writeTextToClipboard } from '@/lib/clipboard'
import { fetchHermesAuthStatus } from '@/lib/hermes-auth'

const POLL_INTERVAL_MS = 2_000
const FAILURE_REVEAL_MS = 5_000

type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function getSetupSteps(
  platform: Platform,
): Array<{ title: string; command: string; note?: string }> {
  const pip = platform === 'windows' ? 'pip' : 'pip3'
  const python = platform === 'windows' ? 'python' : 'python3'

  return [
    {
      title: 'OpenAI 호환 백엔드를 사용하세요',
      command: 'HERMES_API_URL을 백엔드 기본 URL로 설정',
      note: '/v1/chat/completions을 제공하는 모든 백엔드와 호환됩니다 (Ollama, LiteLLM, vLLM 등)',
    },
    {
      title: '선택: Hermes 게이트웨이 로컬 실행',
      command: 'git clone https://github.com/outsourc-e/hermes-agent.git',
      note: 'Hermes 게이트웨이 API를 통해 세션, 스킬, 메모리 등 워크스페이스 추가 기능을 사용할 수 있습니다',
    },
    {
      title: '게이트웨이 설치',
      command: `cd hermes-agent && ${python} -m venv .venv && ${platform === 'windows' ? '.venv\\\\Scripts\\\\activate' : 'source .venv/bin/activate'} && ${pip} install -e .`,
    },
    {
      title: 'HTTP API 서버 활성화',
      command: 'echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env',
      note: '게이트웨이 HTTP API는 선택 사항입니다. 활성화하지 않으면 메시징 플랫폼만 지원하고 워크스페이스용 포트 8642가 열리지 않습니다.',
    },
    {
      title: '게이트웨이 시작',
      command: `cd hermes-agent && ${platform === 'windows' ? '.venv\\\\Scripts\\\\activate' : 'source .venv/bin/activate'} && hermes --gateway`,
      note: '또는 hermes-agent가 이미 설치된 경우 아래 자동 시작을 사용하세요',
    },
  ]
}

type Props = { onConnected: (status: AuthStatus) => void }

declare global {
  interface Window {
    __dismissSplash?: () => void
  }
}

export function ConnectionStartupScreen({ onConnected }: Props) {
  const [showFailureState, setShowFailureState] = useState(false)
  const [serverStarting, setServerStarting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverLog, setServerLog] = useState<Array<string>>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showManual, setShowManual] = useState(false)

  const platform = useRef<Platform>(detectPlatform())
  const steps = getSetupSteps(platform.current)

  const onConnectedRef = useRef(onConnected)
  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  const isDone = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismiss = window.__dismissSplash
    if (!dismiss) return
    const timer = setTimeout(() => dismiss(), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    isDone.current = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const failureTimer = setTimeout(() => {
      if (!isDone.current) {
        setShowFailureState(true)
      }
    }, FAILURE_REVEAL_MS)

    const tryConnect = async () => {
      try {
        const status = await fetchHermesAuthStatus()
        if (isDone.current) return
        isDone.current = true
        clearTimeout(failureTimer)
        if (pollTimer) clearTimeout(pollTimer)
        onConnectedRef.current(status)
      } catch {
        if (isDone.current) return
        pollTimer = setTimeout(tryConnect, POLL_INTERVAL_MS)
      }
    }

    void tryConnect()

    return () => {
      isDone.current = true
      if (pollTimer) clearTimeout(pollTimer)
      clearTimeout(failureTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (copiedIdx === null) return
    const timer = setTimeout(() => setCopiedIdx(null), 2_000)
    return () => clearTimeout(timer)
  }, [copiedIdx])

  const handleCopy = async (text: string, idx: number) => {
    try {
      await writeTextToClipboard(text)
      setCopiedIdx(idx)
    } catch {
      /* clipboard not available */
    }
  }

  const handleAutoStart = async () => {
    setServerStarting(true)
    setServerError(null)
    setServerLog(['hermes-agent 찾는 중...'])
    try {
      const res = await fetch('/api/start-hermes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const msg = `Unexpected response (${res.status})`
        setServerLog([`Error: ${msg}`])
        setServerError(msg)
        setServerStarting(false)
        return
      }

      const data = (await res.json()) as Record<string, unknown>
      if (res.ok && data.ok) {
        setServerLog([
          String(data.message || '시작됨 — 연결 대기 중...'),
        ])
        setServerStarting(false)
        return
      }

      const msg = String(data.error || 'hermes-agent를 찾을 수 없습니다')
      const hint = data.hint ? String(data.hint) : ''
      setServerLog([`Error: ${msg}`])
      if (hint) setServerLog((prev) => [...prev, `Hint: ${hint}`])
      setServerError(msg)
      setServerStarting(false)
      // Show manual steps when auto-start fails
      setShowManual(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setServerLog([`Failed: ${msg}`])
      setServerError(msg)
      setServerStarting(false)
      setShowManual(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-6 py-10 text-white"
      style={{
        backgroundColor: '#0A0E1A',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <img
          src="/petasos-avatar.webp"
          alt="Hermes"
          className="mb-5 h-20 w-20 rounded-2xl object-cover shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        />

        <h1 className="text-[2rem] font-semibold tracking-tight text-white">
          Petasos
        </h1>

        {/* Connecting spinner */}
        <div
          className={[
            'mt-4 flex items-center gap-3 text-sm text-white/72 transition-opacity duration-300',
            showFailureState ? 'opacity-0 h-0' : 'opacity-100',
          ].join(' ')}
          aria-hidden={showFailureState}
        >
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span>백엔드에 연결 중...</span>
        </div>

        {/* Failure state — setup guide */}
        <div
          className={[
            'w-full overflow-hidden transition-all duration-500 ease-out',
            showFailureState
              ? 'mt-6 max-h-[60rem] translate-y-0 opacity-100'
              : 'max-h-0 translate-y-2 opacity-0',
          ].join(' ')}
        >
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <p className="text-base font-medium text-white">
              환영합니다! 백엔드를 연결하세요
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Petasos는 모든 OpenAI 호환 백엔드에서 작동합니다. Hermes
              게이트웨이 API가 감지되면 고급 기능이 자동으로 활성화됩니다.
            </p>

            {/* Auto-start section */}
            <div className="mt-5">
              <button
                type="button"
                disabled={serverStarting}
                onClick={handleAutoStart}
                className={[
                  'w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                  serverStarting
                    ? 'cursor-not-allowed bg-indigo-900/70 text-indigo-200'
                    : 'bg-indigo-500 text-white hover:bg-indigo-400',
                ].join(' ')}
              >
                {serverStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
                    감지 중...
                  </span>
                ) : (
                  'Hermes 게이트웨이 자동 시작'
                )}
              </button>

              {/* Server log */}
              {serverLog.length > 0 ? (
                <div
                  className={[
                    'mt-3 rounded-xl border p-3',
                    serverError
                      ? 'border-red-500/20 bg-red-950/30'
                      : 'border-emerald-500/20 bg-emerald-950/30',
                  ].join(' ')}
                >
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-white/70">
                    {serverLog.join('\n')}
                  </pre>
                </div>
              ) : null}
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="text-xs font-medium text-white/50 transition hover:text-white/70"
              >
                {showManual ? '숨기기' : '보기'} 수동 설정
              </button>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Manual setup steps */}
            <div
              className={[
                'overflow-hidden transition-all duration-300',
                showManual ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0',
              ].join(' ')}
            >
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-white/90">
                          {step.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(step.command, idx)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
                      >
                        {copiedIdx === idx ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 text-white/80">
                      <code>{step.command}</code>
                    </pre>
                    {step.note ? (
                      <p className="mt-2 text-xs text-white/40">{step.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Env var hint */}
              <div className="mt-4 rounded-xl border border-white/6 bg-white/3 p-3">
                <p className="text-xs font-medium text-white/50">
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
                    HERMES_API_URL
                  </code>{' '}
                  을 OpenAI 호환 백엔드에 설정하세요:
                </p>
                <pre className="mt-2 overflow-x-auto font-mono text-xs text-white/60">
                  HERMES_API_URL=http://your-server:8642 pnpm dev
                </pre>
              </div>
            </div>
          </div>
        </div>

        {!showFailureState ? (
          <p className="mt-6 text-xs text-white/45">
            호환되는 백엔드가 감지되면 자동으로 새로고침됩니다
          </p>
        ) : null}
      </div>
    </div>
  )
}
