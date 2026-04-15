import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { createTask, listTasks } from '../../server/tasks-store'
import type { TaskColumn, TaskPriority } from '../../server/tasks-store'

const TASK_COLUMNS: readonly string[] = ['backlog', 'todo', 'in_progress', 'review', 'done']
const TASK_PRIORITIES: readonly string[] = ['high', 'medium', 'low']
function isValidColumn(value: string): value is TaskColumn {
  return TASK_COLUMNS.includes(value)
}
function isValidPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.includes(value)
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/hermes-tasks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        const url = new URL(request.url)
        const tasks = listTasks({
          column: url.searchParams.get('column'),
          assignee: url.searchParams.get('assignee'),
          priority: url.searchParams.get('priority'),
          includeDone: url.searchParams.get('include_done') === 'true',
        })

        return jsonResponse({ tasks })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.title || typeof body.title !== 'string') {
            return jsonResponse({ error: 'title is required' }, 400)
          }

          const task = createTask({
            id: typeof body.id === 'string' ? body.id : undefined,
            title: body.title,
            description: typeof body.description === 'string' ? body.description : '',
            column: typeof body.column === 'string' && isValidColumn(body.column) ? body.column : undefined,
            priority: typeof body.priority === 'string' && isValidPriority(body.priority) ? body.priority : undefined,
            assignee: typeof body.assignee === 'string' ? body.assignee : null,
            tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string') : [],
            due_date: typeof body.due_date === 'string' ? body.due_date : null,
            position: typeof body.position === 'number' ? body.position : 0,
            created_by: typeof body.created_by === 'string' ? body.created_by : 'user',
          })

          return jsonResponse({ task }, 201)
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
