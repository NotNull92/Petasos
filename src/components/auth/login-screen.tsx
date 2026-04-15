import { useState } from 'react'
import type { FormEvent } from 'react'

export function LoginScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (data.ok) {
        // Success! Reload to trigger auth check
        window.location.reload()
      } else {
        setError(data.error || '잘못된 비밀번호입니다')
        setLoading(false)
      }
    } catch (err) {
      setError('인증에 실패했습니다. 다시 시도하세요.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl shadow-primary-900/5 ring-1 ring-primary-900/5">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <svg
                width="32"
                height="32"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-accent-500"
              >
                <path
                  d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z"
                  fill="currentColor"
                  opacity="0.15"
                />
                <path
                  d="M50 25 L75 38 L75 62 L50 75 L25 62 L25 38 Z"
                  fill="currentColor"
                  opacity="0.3"
                />
                <circle cx="50" cy="50" r="15" fill="currentColor" />
              </svg>
              <h1 className="text-2xl font-bold tracking-tight text-primary-900">
                Petasos
              </h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-lg font-semibold text-primary-900">
            비밀번호 입력
          </h2>
          <p className="mb-6 text-center text-sm text-primary-600">
            이 워크스페이스는 비밀번호로 보호되어 있습니다
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '인증 중...' : '계속'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-primary-500">
          Powered by{' '}
          <a
            href="https://github.com/NousResearch/hermes-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 hover:text-accent-600 transition-colors"
          >
            Hermes
          </a>
        </p>
      </div>
    </div>
  )
}
