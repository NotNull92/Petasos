'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { writeTextToClipboard } from '@/lib/clipboard'

const STORAGE_KEY_SEEN = 'hermes-mobile-setup-seen'

interface MobileSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

function TailscaleIcon() {
  return (
    <svg viewBox="0 0 100 100" className="size-5">
      <circle cx="50" cy="10" r="10" fill="#fff" opacity="0.9" />
      <circle cx="50" cy="50" r="10" fill="#fff" />
      <circle cx="50" cy="90" r="10" fill="#fff" opacity="0.9" />
      <circle cx="10" cy="30" r="10" fill="#fff" opacity="0.6" />
      <circle cx="90" cy="30" r="10" fill="#fff" opacity="0.6" />
      <circle cx="10" cy="70" r="10" fill="#fff" opacity="0.6" />
      <circle cx="90" cy="70" r="10" fill="#fff" opacity="0.6" />
      <circle cx="10" cy="50" r="10" fill="#fff" opacity="0.3" />
      <circle cx="90" cy="50" r="10" fill="#fff" opacity="0.3" />
    </svg>
  )
}

export function MobileSetupModal({ isOpen, onClose }: MobileSetupModalProps) {
  const [step, setStep] = useState(0)
  const [networkUrl, setNetworkUrl] = useState<{
    url: string
    source: 'tailscale' | 'lan' | 'localhost'
  } | null>(null)

  useEffect(() => {
    fetch(`/api/network-url?port=${window.location.port || 3000}`)
      .then(
        (r) =>
          r.json() as Promise<{
            url: string
            source: 'tailscale' | 'lan' | 'localhost'
          }>,
      )
      .then((data) => setNetworkUrl(data))
      .catch(() =>
        setNetworkUrl({ url: window.location.origin, source: 'localhost' }),
      )
  }, [])

  useEffect(() => {
    if (isOpen) setStep(0)
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const steps = [
    {
      title: '데스크톱에 Tailscale 설치',
      body: 'Petasos가 실행 중인 컴퓨터에 Tailscale을 설치하고 로그인하세요.',
      showTailscaleIcon: true,
      action: (
        <a
          href="https://tailscale.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
        >
          Tailscale 다운로드 열기
        </a>
      ),
    },
    {
      title: '백엔드 연결 유지',
      body: 'Petasos는 모바일에서도 OpenAI 호환 백엔드와 통신할 수 있습니다. 워크스페이스와 백엔드 모두 Tailscale이나 로컬 네트워크를 통해 접근 가능한지 확인하세요.',
      showTailscaleIcon: false,
      action: (
        <div className="rounded-lg border border-primary-700 bg-primary-950 px-4 py-3 text-sm text-primary-200">
          Hermes 게이트웨이 고급 API는 선택 사항입니다. 데스크톱에서 기본 채팅이
          이미 작동한다면, 모바일 접근은 주로 네트워크 연결 상태에 따라 결정됩니다.
        </div>
      ),
    },
    {
      title: '휴대폰에 Tailscale 설치',
      body: 'iOS 또는 Android에 Tailscale을 설치하고 같은 계정으로 로그인하세요.',
      showTailscaleIcon: true,
      action: (
        <div className="flex gap-2">
          <a
            href="https://apps.apple.com/app/apple-store/id425072860"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-primary-700 bg-primary-950 px-3 py-2 text-xs font-medium text-primary-100 transition-colors hover:bg-primary-800"
          >
            iOS 앱
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.tailscale.ipn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-primary-700 bg-primary-950 px-3 py-2 text-xs font-medium text-primary-100 transition-colors hover:bg-primary-800"
          >
            Android 앱
          </a>
        </div>
      ),
    },
    {
      title: '휴대폰에서 Petasos 열기',
      body:
        networkUrl?.source === 'tailscale'
          ? 'Tailscale 주소입니다. 휴대폰 브라우저에서 열어 같은 워크스페이스를 사용하세요.'
          : networkUrl?.source === 'lan'
            ? '로컬 네트워크 주소입니다. 휴대폰이 같은 WiFi에 연결되어 있어야 합니다.'
            : 'localhost 외부에서 접근하려면 이 컴퓨터에서 Tailscale을 시작하세요.',
      showTailscaleIcon: networkUrl?.source === 'tailscale',
      action: (
        <button
          type="button"
          onClick={() =>
            networkUrl && writeTextToClipboard(networkUrl.url).catch(() => {})
          }
          className="group flex w-full items-center justify-between rounded-lg border border-primary-700 bg-primary-950 px-4 py-3 transition-colors hover:border-accent-500/50"
        >
          <span className="break-all font-mono text-sm text-accent-300">
            {networkUrl?.url ?? '…'}
          </span>
          <span className="ml-3 shrink-0 text-primary-500 group-hover:text-accent-400">
            {networkUrl?.source === 'tailscale' && (
              <svg viewBox="0 0 100 100" className="size-4 opacity-60">
                <circle
                  cx="50"
                  cy="10"
                  r="10"
                  fill="currentColor"
                  opacity="0.9"
                />
                <circle cx="50" cy="50" r="10" fill="currentColor" />
                <circle
                  cx="50"
                  cy="90"
                  r="10"
                  fill="currentColor"
                  opacity="0.9"
                />
                <circle
                  cx="10"
                  cy="30"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="90"
                  cy="30"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="10"
                  cy="70"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
                <circle
                  cx="90"
                  cy="70"
                  r="10"
                  fill="currentColor"
                  opacity="0.6"
                />
              </svg>
            )}
          </span>
        </button>
      ),
    },
  ]

  const currentStep = steps[step]
  const isLastStep = step === steps.length - 1

  const handleNext = () => {
    if (!isLastStep) {
      setStep((prev) => prev + 1)
      return
    }

    localStorage.setItem(STORAGE_KEY_SEEN, 'true')
    onClose()
  }

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative w-full max-w-md rounded-2xl border border-primary-800/60 bg-primary-950 p-5 text-white shadow-2xl shadow-black/40"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-primary-400 transition-colors hover:bg-primary-900 hover:text-primary-200"
          aria-label="모바일 설정 닫기"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-10">
          <img
            src="/petasos-avatar.webp"
            alt="Hermes"
            className="size-9 rounded-xl"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">모바일 설정</h2>
            <div className="mt-1 flex items-center gap-1.5">
              {steps.map((_, index) => (
                <span
                  key={`step-indicator-${index}`}
                  className={`h-2 w-6 rounded-full transition-colors ${
                    index === step ? 'bg-accent-500' : 'bg-primary-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-primary-900 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 flex items-center gap-2">
                {currentStep.showTailscaleIcon ? <TailscaleIcon /> : null}
                <h3 className="text-sm font-semibold text-primary-100">
                  {currentStep.title}
                </h3>
              </div>
              <p className="mb-4 text-sm text-primary-300">
                {currentStep.body}
              </p>
              <div>{currentStep.action}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="rounded-lg px-3 py-2 text-sm text-primary-400 transition-colors hover:text-primary-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-primary-400 transition-colors hover:text-primary-200"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
            >
              {isLastStep ? '완료' : '다음'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
