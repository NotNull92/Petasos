import { useEffect, useRef } from 'react'
import { useChatStore } from '../../../stores/chat-store'

type ActiveRunStatus =
  | 'accepted'
  | 'active'
  | 'handoff'
  | 'stalled'
  | 'complete'
  | 'error'

type ActiveRunResponse = {
  ok: boolean
  run: {
    runId: string
    status: ActiveRunStatus
    sessionKey: string
    startedAt: number
    assistantText?: string
    thinkingText?: string
    toolCalls?: Array<{
      id: string
      name: string
      phase: string
      args?: unknown
      preview?: string
      result?: string
    }>
    lifecycleEvents?: Array<{
      text: string
      emoji: string
      timestamp: number
      isError: boolean
    }>
  } | null
}

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  'accepted',
  'active',
  'handoff',
])

/**
 * Checks whether the server has an active run for this session.
 *
 * - On mount: restores waiting state so UI shows the spinner.
 * - On visibilitychange (foreground): re-checks and injects any
 *   assistant text that was generated while the page was in background,
 *   so the user sees the response resume seamlessly.
 *
 * When the run is still active after foreground recovery, sets up a
 * polling interval to keep the streaming state updated until the run
 * completes (SSE may be dead after a background kill).
 */
export function useActiveRunCheck({
  sessionKey,
  enabled,
}: {
  sessionKey: string
  enabled: boolean
}): void {
  const hasCheckedRef = useRef(false)
  const sessionKeyRef = useRef(sessionKey)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  sessionKeyRef.current = sessionKey

  function clearPoll() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  async function checkAndRestore(runSource: 'mount' | 'foreground') {
    const key = sessionKeyRef.current
    if (!key || key === 'new') return

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(key)}/active-run`,
      )
      if (!response.ok) return

      const data = (await response.json()) as ActiveRunResponse
      if (!data.ok) return

      const store = useChatStore.getState()

      if (data.run && ACTIVE_STATUSES.has(data.run.status)) {
        // Run is still active — restore waiting state
        store.setSessionWaiting(key, data.run.runId)

        // On foreground recovery, inject the assistant text accumulated
        // on the server so the user sees what was generated while away.
        if (runSource === 'foreground' && data.run.assistantText) {
          const streamingMap = new Map(store.streamingState)
          const existing = streamingMap.get(key)
          // Only inject if we don't have newer text locally, or if local
          // streaming state was lost (page reload).
          if (!existing || !existing.text || existing.text.length < data.run.assistantText.length) {
            const restored = {
              runId: data.run.runId,
              text: data.run.assistantText,
              thinking: data.run.thinkingText || existing?.thinking || '',
              lifecycleEvents: data.run.lifecycleEvents || existing?.lifecycleEvents || [],
              toolCalls: data.run.toolCalls || existing?.toolCalls || [],
            }
            streamingMap.set(key, restored)
            store.streamingState = streamingMap
            // Trigger Zustand subscribers
            useChatStore.setState({ streamingState: streamingMap })
          }

          // Start polling to keep updating while SSE is dead
          clearPoll()
          pollIntervalRef.current = setInterval(async () => {
            try {
              const pollRes = await fetch(
                `/api/sessions/${encodeURIComponent(key)}/active-run`,
              )
              if (!pollRes.ok) return
              const pollData = (await pollRes.json()) as ActiveRunResponse
              if (!pollData.ok || !pollData.run) {
                clearPoll()
                return
              }

              if (!ACTIVE_STATUSES.has(pollData.run.status)) {
                // Run finished — stop polling, refetch history
                clearPoll()
                store.clearSessionWaiting(key)
                // Clear streaming state — history will provide the final message
                const clearedMap = new Map(useChatStore.getState().streamingState)
                clearedMap.delete(key)
                useChatStore.setState({ streamingState: clearedMap })
                return
              }

              // Update streaming state with latest text from server
              const currentStore = useChatStore.getState()
              const currentMap = new Map(currentStore.streamingState)
              currentMap.set(key, {
                runId: pollData.run.runId,
                text: pollData.run.assistantText || '',
                thinking: pollData.run.thinkingText || '',
                lifecycleEvents: pollData.run.lifecycleEvents || [],
                toolCalls: pollData.run.toolCalls || [],
              })
              useChatStore.setState({ streamingState: currentMap })
            } catch {
              // Network error — stop polling
              clearPoll()
            }
          }, 1500)
        }
      } else if (data.run && !ACTIVE_STATUSES.has(data.run.status)) {
        // Run ended while we were away
        if (store.isSessionWaiting(key)) {
          store.clearSessionWaiting(key)
        }
        // Clear any stale streaming state
        const currentMap = new Map(store.streamingState)
        if (currentMap.has(key)) {
          currentMap.delete(key)
          useChatStore.setState({ streamingState: currentMap })
        }
      } else {
        // No run at all
        if (store.isSessionWaiting(key)) {
          store.clearSessionWaiting(key)
        }
      }
    } catch {
      // Network error or abort — ignore
    }
  }

  // Mount check
  useEffect(() => {
    if (!enabled || !sessionKey || sessionKey === 'new') return
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    void checkAndRestore('mount')

    return () => {
      clearPoll()
    }
  }, [sessionKey, enabled])

  // Reset check flag when session changes
  useEffect(() => {
    hasCheckedRef.current = false
    clearPoll()
  }, [sessionKey])

  // Foreground recovery on visibilitychange
  useEffect(() => {
    if (!enabled || !sessionKey || sessionKey === 'new') return

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        // Re-check on foreground — allow repeat checks for background recovery
        void checkAndRestore('foreground')
      } else {
        // Going to background — stop polling
        clearPoll()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearPoll()
    }
  }, [sessionKey, enabled])

  // Also handle pageshow (back/forward cache recovery)
  useEffect(() => {
    if (!enabled || !sessionKey || sessionKey === 'new') return

    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        // Page restored from bfcache — re-check
        void checkAndRestore('foreground')
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [sessionKey, enabled])
}
