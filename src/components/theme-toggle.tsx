import { ComputerIcon, Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { SettingsThemeMode } from '@/hooks/use-settings'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

function resolvedIsDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

const MODES: Array<{
  value: SettingsThemeMode
  icon: typeof ComputerIcon
  label: string
}> = [
  { value: 'system', icon: ComputerIcon, label: '시스템' },
  { value: 'light', icon: Sun01Icon, label: '라이트' },
  { value: 'dark', icon: Moon01Icon, label: '다크' },
]

type ThemeToggleProps = {
  /** "icon" = small icon button, "pill" = 3-way pill toggle (default) */
  variant?: 'icon' | 'pill'
}

export function ThemeToggle({ variant = 'pill' }: ThemeToggleProps) {
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && resolvedIsDark())
  const currentThemeLabel =
    MODES.find((mode) => mode.value === settings.theme)?.label ?? '시스템'

  function setTheme(theme: SettingsThemeMode) {
    applyTheme(theme)
    updateSettings({ theme })
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="inline-flex size-7 items-center justify-center rounded-md text-primary-400 transition-colors hover:text-primary-700 dark:hover:text-primary-300"
        aria-label={`현재 테마: ${currentThemeLabel}. ${isDark ? '라이트' : '다크'} 모드로 전환`}
        title={isDark ? '라이트 모드' : '다크 모드'}
      >
        <HugeiconsIcon
          icon={isDark ? Sun01Icon : Moon01Icon}
          size={16}
          strokeWidth={1.5}
        />
      </button>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-primary-200 bg-primary-100/70 p-0.5 dark:border-primary-700 dark:bg-primary-800/80"
      role="group"
      aria-label={`테마 모드. 현재: ${currentThemeLabel}`}
    >
      {MODES.map((mode) => {
        const active = settings.theme === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setTheme(mode.value)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full transition-all duration-200',
              active
                ? 'bg-accent-500 text-white shadow-sm'
                : 'text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200',
            )}
            aria-label={
              active ? `${mode.label} 테마 (현재)` : `${mode.label} 테마`
            }
            title={mode.label}
          >
            <HugeiconsIcon icon={mode.icon} size={14} strokeWidth={1.8} />
          </button>
        )
      })}
    </div>
  )
}
