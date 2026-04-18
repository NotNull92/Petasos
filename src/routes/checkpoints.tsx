import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { CheckpointsScreen } from '@/screens/checkpoints/checkpoints-screen'

export const Route = createFileRoute('/checkpoints')({
  ssr: false,
  component: CheckpointsRoute,
})

function CheckpointsRoute() {
  usePageTitle('레포 관리')
  return <CheckpointsScreen />
}
