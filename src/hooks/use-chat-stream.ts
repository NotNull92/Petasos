import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '../stores/chat-store'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000
const SILENT_TIMEOUT_MS = 60_000

export function useChatStream(opts: {
  sessionKey?: string
  enabled?: boolean
  onReconnect?: () => void
  onSilentTimeout?: (ms: number) => void
  onUserMessage?: (message: any, source?: string) => void
  onApprovalRequest?: (approval: Record<string, unknown>) => void
  onCompactionStart?: () => void
  onCompactionEnd?: () => void
  onCompaction?: (...args: Array<any>) => void
  onDone?: (...args: Array<any>) => void
}) {
  const {
    sessionKey,
    enabled = true,
    onReconnect,
    onSilentTimeout,
    onUserMessage,
    onApprovalRequest,
    onCompactionStart,
    onCompactionEnd,
    onCompaction,
    onDone,
  } = opts

  // ─── Refs (stable references for callbacks inside event handlers) ───────
  const optsRef = useRef({
    sessionKey,
    enabled,
    onReconnect,
    onSilentTimeout,
    onUserMessage,
    onApprovalRequest,
    onCompactionStart,
    onCompactionEnd,
    onCompaction,
    onDone,
  })
  optsRef.current = {
    sessionKey,
    enabled,
    onReconnect,
    onSilentTimeout,
    onUserMessage,
    onApprovalRequest,
    onCompactionStart,
    onCompactionEnd,
    onCompaction,
    onDone,
  }

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEventTimeRef = useRef<number>(Date.now())
  const isReconnectingRef = useRef(false)

  // ─── Zustand store selectors ────────────────────────────────────────────
  const storeConnectionState = useChatStore((s) => s.connectionState)
  const storeLastError = useChatStore((s) => s.lastError)
  const processEvent = useChatStore((s) => s.processEvent)
  const getStreamingState = useChatStore((s) => s.getStreamingState)
  const setConnectionState = useChatStore((s) => s.setConnectionState)

  // Map store connection state to the 3-state interface used by consumers.
  // The store also has 'error', which we map to 'disconnected'.
  const connectionState: ConnectionState =
    storeConnectionState === 'connected'
      ? 'connected'
      : storeConnectionState === 'connecting'
        ? 'connecting'
        : 'disconnected'

  // ─── Silent timeout detection ──────────────────────────────────────────
  const resetSilentTimer = useCallback(() => {
    lastEventTimeRef.current = Date.now()
    if (silentTimerRef.current) clearTimeout(silentTimerRef.current)
    silentTimerRef.current = setTimeout(() => {
      const silentMs = Date.now() - lastEventTimeRef.current
      optsRef.current.onSilentTimeout?.(silentMs)
    }, SILENT_TIMEOUT_MS)
  }, [])

  // ─── Close EventSource helper ──────────────────────────────────────────
  const closeEs = useCallback(() => {
    if (silentTimerRef.current) {
      clearTimeout(silentTimerRef.current)
      silentTimerRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  // ─── Connect / reconnect logic ─────────────────────────────────────────
  const connect = useCallback(() => {
    closeEs()

    if (!optsRef.current.enabled) {
      setConnectionState('disconnected')
      return
    }

    setConnectionState('connecting')

    const es = new EventSource('/api/events')
    esRef.current = es

    es.onopen = () => {
      backoffRef.current = INITIAL_BACKOFF_MS
      setConnectionState('connected')
      if (isReconnectingRef.current) {
        isReconnectingRef.current = false
        optsRef.current.onReconnect?.()
      }
      resetSilentTimer()
    }

    es.onerror = () => {
      setConnectionState('disconnected')
      es.close()
      esRef.current = null

      if (!optsRef.current.enabled) return

      // Exponential backoff reconnect
      isReconnectingRef.current = true
      const delay = backoffRef.current
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        if (optsRef.current.enabled) {
          connect()
        }
      }, delay)
    }

    // ─── SSE event handlers ────────────────────────────────────────────

    // Server sends `event: connected` on initial connection
    es.addEventListener('connected', () => {
      backoffRef.current = INITIAL_BACKOFF_MS
      lastEventTimeRef.current = Date.now()
    })

    // All chat events from the bus use named event types.
    // The server sends: event: <type>\ndata: <json>\n\n
    const chatEventTypes = [
      'user_message',
      'message',
      'chunk',
      'thinking',
      'tool',
      'done',
      'artifact',
      'status',
      'lifecycle',
    ] as const

    for (const eventType of chatEventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        lastEventTimeRef.current = Date.now()
        resetSilentTimer()

        let data: Record<string, unknown>
        try {
          data = JSON.parse(e.data)
        } catch {
          return
        }

        const eventSessionKey = data.sessionKey as string | undefined
        const currentSessionKey = optsRef.current.sessionKey

        // Dispatch to chat-store's processEvent (central state management)
        const storeEvent = {
          type: eventType,
          ...data,
          transport: 'chat-events' as const,
        }
        processEvent(storeEvent as any)

        // ─── Fire consumer callbacks ─────────────────────────────────
        // Filter: only fire callbacks for events matching our sessionKey
        // (or all events if no sessionKey filter is set)
        if (
          currentSessionKey &&
          eventSessionKey &&
          eventSessionKey !== currentSessionKey
        ) {
          return
        }

        switch (eventType) {
          case 'user_message': {
            optsRef.current.onUserMessage?.(
              data.message,
              data.source as string | undefined,
            )
            break
          }
          case 'message': {
            const msg = data.message as any
            if (msg?.role === 'user') {
              optsRef.current.onUserMessage?.(msg)
            }
            break
          }
          case 'done': {
            const streamingSnapshot = eventSessionKey
              ? getStreamingState(eventSessionKey)
              : null
            optsRef.current.onDone?.(
              data.state,
              eventSessionKey ?? '',
              streamingSnapshot,
            )
            break
          }
          case 'tool': {
            // Tool events are handled by the store's processEvent above.
            // No separate callback needed unless onCompaction is provided.
            break
          }
          default:
            break
        }
      })
    }

    // Handle compaction events (separate event name from server)
    es.addEventListener('compaction', (e: MessageEvent) => {
      lastEventTimeRef.current = Date.now()
      resetSilentTimer()

      let data: Record<string, unknown>
      try {
        data = JSON.parse(e.data)
      } catch {
        return
      }

      const eventSessionKey = data.sessionKey as string | undefined
      const currentSessionKey = optsRef.current.sessionKey

      if (
        currentSessionKey &&
        eventSessionKey &&
        eventSessionKey !== currentSessionKey
      ) {
        return
      }

      optsRef.current.onCompaction?.(data)

      const phase = data.phase as string | undefined
      if (phase === 'start') {
        optsRef.current.onCompactionStart?.()
      } else if (phase === 'end') {
        optsRef.current.onCompactionEnd?.()
      }
    })

    // Handle approval_request events
    es.addEventListener('approval_request', (e: MessageEvent) => {
      lastEventTimeRef.current = Date.now()
      resetSilentTimer()

      let data: Record<string, unknown>
      try {
        data = JSON.parse(e.data)
      } catch {
        return
      }

      optsRef.current.onApprovalRequest?.(data)
    })
  }, [closeEs, processEvent, getStreamingState, setConnectionState, resetSilentTimer])

  // ─── Manual reconnect ──────────────────────────────────────────────────
  const reconnect = useCallback(() => {
    isReconnectingRef.current = true
    backoffRef.current = INITIAL_BACKOFF_MS
    connect()
  }, [connect])

  // ─── Lifecycle: connect on mount / enabled change ──────────────────────
  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      closeEs()
      setConnectionState('disconnected')
    }
    return () => {
      closeEs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionKey, connect, closeEs, setConnectionState])

  return {
    connectionState,
    lastError: storeLastError,
    reconnect,
  }
}
