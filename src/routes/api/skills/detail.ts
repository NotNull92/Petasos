import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  BEARER_TOKEN,
  HERMES_API,
} from '../../../server/gateway-capabilities'

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

export const Route = createFileRoute('/api/skills/detail')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const name = (url.searchParams.get('name') || '').trim()
          const filePath = url.searchParams.get('file_path') || ''

          if (!name) {
            return json(
              { ok: false, error: 'name parameter is required' },
              { status: 400 },
            )
          }

          let hermesUrl = `${HERMES_API}/api/skills/${encodeURIComponent(name)}`
          if (filePath) {
            hermesUrl += `?file_path=${encodeURIComponent(filePath)}`
          }

          const response = await fetch(hermesUrl, {
            headers: {
              ...authHeaders(),
            },
            signal: AbortSignal.timeout(30_000),
          })

          const result = await response.json()
          return json(result, { status: response.status })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : '스킬 상세 정보를 불러오지 못했습니다',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
