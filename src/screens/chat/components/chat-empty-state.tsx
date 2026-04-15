import { HugeiconsIcon } from '@hugeicons/react'
import { BrainIcon, CodeIcon, PuzzleIcon } from '@hugeicons/core-free-icons'
import { motion } from 'motion/react'

type SuggestionChip = {
  label: string
  prompt: string
  icon: unknown
}

const SUGGESTIONS: Array<SuggestionChip> = [
  {
    label: '워크스페이스 분석',
    prompt:
      '이 워크스페이스 구조를 분석하고 엔지니어링 리스크 3가지를 알려줘. 도구를 활용하고 간결하게 답변해.',
    icon: CodeIcon,
  },
  {
    label: '환경설정 저장',
    prompt:
      '다음 내용을 메모리에 저장해줘: "데모에서는 글머리 3개 이하로, 리스크를 먼저 표시." 저장 후 확인해줘.',
    icon: BrainIcon,
  },
  {
    label: '파일 만들기',
    prompt: '이 앱을 위한 데모 체크리스트 항목 5개가 담긴 demo-checklist.md 파일을 만들어줘.',
    icon: PuzzleIcon,
  },
]

type ChatEmptyStateProps = {
  onSuggestionClick?: (prompt: string) => void
  compact?: boolean
}

export function ChatEmptyState({
  onSuggestionClick,
  compact = false,
}: ChatEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center px-4 py-8"
    >
      <div className="flex max-w-xl flex-col items-center text-center">
        {/* Avatar with accent glow */}
        <div className="relative mb-5">
          <div
            className="absolute inset-0 rounded-2xl blur-2xl opacity-35"
            style={{
              background: 'var(--theme-accent)',
              transform: 'scale(1.6)',
            }}
          />
          <img
            src="/petasos-avatar.webp"
            alt="Hermes"
            className="relative size-20 rounded-2xl"
            style={{
              boxShadow:
                '0 8px 32px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            }}
          />
        </div>

        {/* Title + value prop */}
        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--theme-text)' }}
        >
          Petasos
        </h2>

        {!compact && (
          <>
            <p className="mt-2 text-sm" style={{ color: 'var(--theme-muted)' }}>
              에이전트 채팅 · 실시간 도구 · 메모리 · 전체 관측 가능
            </p>
          </>
        )}

        {/* Prompt chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--theme-card2)'
                e.currentTarget.style.borderColor = 'var(--theme-accent-border)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--theme-card)'
                e.currentTarget.style.borderColor = 'var(--theme-border)'
              }}
            >
              <HugeiconsIcon
                icon={suggestion.icon as any}
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--theme-accent)' }}
              />
              {suggestion.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
