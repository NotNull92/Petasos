import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  ensureGatewayProbed,
  getCapabilities,
} from '../../../server/gateway-capabilities'
import { replaceMemory } from '../../../server/hermes-api'
import { requireJsonContentType } from '../../../server/rate-limit'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'

export const Route = createFileRoute('/api/memory/replace')({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        await ensureGatewayProbed()
        if (!getCapabilities().memory) {
          return json(
            createCapabilityUnavailablePayload('memory', {
              error: 'Memory operations are unavailable on this backend.',
            }),
            { status: 503 },
          )
        }

        try {
          const body = (await request.json().catch(() => ({}))) as {
            target?: unknown
            old_text?: unknown
            content?: unknown
          }
          const target =
            typeof body.target === 'string' ? body.target : 'memory'
          const old_text =
            typeof body.old_text === 'string' ? body.old_text : ''
          const content =
            typeof body.content === 'string' ? body.content : ''
          if (!old_text.trim()) {
            return json(
              { error: 'old_text is required' },
              { status: 400 },
            )
          }
          if (!content.trim()) {
            return json(
              { error: 'content is required' },
              { status: 400 },
            )
          }

          const result = await replaceMemory(target, old_text, content)
          return json(result)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to replace memory item'
          return json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
