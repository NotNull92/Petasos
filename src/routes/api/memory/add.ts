import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  ensureGatewayProbed,
  getCapabilities,
} from '../../../server/gateway-capabilities'
import { addMemory } from '../../../server/hermes-api'
import { requireJsonContentType } from '../../../server/rate-limit'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'

export const Route = createFileRoute('/api/memory/add')({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
            content?: unknown
          }
          const target =
            typeof body.target === 'string' ? body.target : 'memory'
          const content =
            typeof body.content === 'string' ? body.content : ''
          if (!content.trim()) {
            return json(
              { error: 'content is required' },
              { status: 400 },
            )
          }

          const result = await addMemory(target, content)
          return json(result)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to add memory item'
          return json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
