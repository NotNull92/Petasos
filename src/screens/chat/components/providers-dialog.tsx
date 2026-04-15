import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProvidersScreen } from '@/screens/settings/providers-screen'

type ProvidersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProvidersDialog({ open, onOpenChange }: ProvidersDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85dvh,680px)] w-[min(640px,92vw)] max-h-[calc(100dvh-3rem)] flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between border-b border-primary-200 p-4 pb-3">
          <div>
            <DialogTitle className="mb-1">프로바이더</DialogTitle>
            <DialogDescription className="text-pretty">
              현재 페이지를 벗어나지 않고 프로바이더를 설정할 수 있습니다.
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-800 hover:text-primary-700"
                aria-label="프로바이더 대화상자 닫기"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={20}
                  strokeWidth={1.5}
                />
              </Button>
            }
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProvidersScreen embedded />
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
